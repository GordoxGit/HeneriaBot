/**
 * Gestionnaire de tickets
 * Gère la création, la fermeture et la gestion des tickets
 */

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const db = require('../database/db');
const { createEmbed, errorEmbed } = require('./embedBuilder');
const logger = require('./logger');
const { generateTranscript } = require('./transcriptGenerator');

/**
 * Crée un nouveau ticket pour un utilisateur
 * @param {import('discord.js').ButtonInteraction} interaction - L'interaction du bouton
 * @param {string} ticketType - Le type de ticket (help, report, partnership, bug)
 */
async function createTicket(interaction, ticketType) {
  const { guild, member, user } = interaction;

  try {
    // 1. Vérifier si l'utilisateur a déjà un ticket ouvert
    const existingTicket = db.get(
      'SELECT id, channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = ?',
      [guild.id, user.id, 'open']
    );

    if (existingTicket) {
      return interaction.reply({
        embeds: [errorEmbed(`Vous avez déjà un ticket ouvert : <#${existingTicket.channel_id}>`)],
        ephemeral: true
      });
    }

    // 2. Récupérer la configuration
    const ticketConfig = db.get('SELECT * FROM ticket_config WHERE guild_id = ?', [guild.id]);

    // Si pas de config, on ne peut pas continuer (ou on utilise des valeurs par défaut limitées ?)
    // Le staff role est critique pour les perms
    const staffRoleId = ticketConfig ? ticketConfig.staff_role_id : null;

    // 3. Récupérer la catégorie pour ce type de ticket
    const categoryConfig = db.get(
      'SELECT category_id, label FROM ticket_categories WHERE guild_id = ? AND type = ? AND enabled = 1',
      [guild.id, ticketType]
    );

    // Si pas de catégorie configurée pour ce type, on avertit
    if (!categoryConfig) {
      logger.warn(`Tentative de création de ticket ${ticketType} sans catégorie configurée sur ${guild.name}`);
      return interaction.reply({
        embeds: [errorEmbed('Ce type de ticket n\'est pas encore configuré sur ce serveur.')],
        ephemeral: true
      });
    }

    // Répondre à l'interaction pour dire qu'on traite la demande (et éviter le timeout)
    // On utilise reply ephemeral car c'est une action privée
    // Note: Si on met trop de temps avant ce reply, l'interaction peut fail.
    // Mais comme on crée un channel, ça peut prendre > 3s.
    await interaction.deferReply({ ephemeral: true });

    // 4. Calculer le numéro du ticket (ID séquentiel par serveur)
    // On compte tous les tickets (ouverts ou fermés) pour ce serveur
    const countResult = db.get('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?', [guild.id]);
    const ticketNumber = (countResult ? countResult.count : 0) + 1;
    // Formatage 4 chiffres : 0001
    const ticketIdFormatted = ticketNumber.toString().padStart(4, '0');

    // 5. Créer le nom du salon
    // Format : ticket-{type}-{username}-{id}
    // On sanitize le username pour éviter les caractères spéciaux qui cassent le nom de channel
    const sanitizedUsername = user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
    const channelName = `ticket-${ticketType}-${sanitizedUsername}-${ticketIdFormatted}`;

    // 6. Configurer les permissions
    const permissionOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id, // Créateur
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },
      {
        id: interaction.client.user.id, // Bot
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels
        ]
      }
    ];

    // Ajouter le staff si configuré
    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }

    // 7. Créer le salon
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryConfig.category_id,
      permissionOverwrites: permissionOverwrites,
      topic: `Ticket #${ticketNumber} de ${user.tag} | Type: ${categoryConfig.label} | ID: ${user.id}`
    });

    // 8. Envoyer l'embed dans le ticket
    const embed = createEmbed()
      .setTitle(`🎫 Ticket #${ticketIdFormatted} - ${categoryConfig.label}`)
      .setDescription(`Bonjour ${member},

Merci d'avoir ouvert un ticket !
Un membre du staff va vous répondre dès que possible.

**En attendant :**
• Expliquez votre demande de manière claire
• Fournissez un maximum de détails
• Patientez, le staff arrive bientôt !`)
      .addFields(
        { name: '👤 Créé par', value: user.tag, inline: true },
        { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: '📝 Type', value: categoryConfig.label, inline: true }
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Fermer le ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

    await ticketChannel.send({
      content: `${member} ${staffRoleId ? `<@&${staffRoleId}>` : ''}`,
      embeds: [embed],
      components: [row]
    });

    // 9. Enregistrer en BDD
    const insertResult = db.run(
      `INSERT INTO tickets (guild_id, user_id, channel_id, category, status, created_at)
       VALUES (?, ?, ?, ?, 'open', CURRENT_TIMESTAMP)`,
      [guild.id, user.id, ticketChannel.id, ticketType]
    );

    // 10. Notification staff (si configuré)
    if (ticketConfig && ticketConfig.staff_channel_id) {
      const staffChannel = guild.channels.cache.get(ticketConfig.staff_channel_id);
      if (staffChannel) {
        const staffEmbed = createEmbed()
          .setTitle('🔔 Nouveau Ticket')
          .setDescription('Un nouveau ticket a été ouvert !')
          .addFields(
            { name: '👤 Membre', value: `${member} (${user.tag})`, inline: true },
            { name: '📝 Type', value: categoryConfig.label, inline: true },
            { name: '🔗 Salon', value: `<#${ticketChannel.id}>`, inline: true }
          );

        // Récupérer l'ID auto-incrémenté de la dernière insertion (pour les boutons staff)
        const dbTicketId = insertResult.lastInsertRowid;

        const staffRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_claim_${dbTicketId}`)
              .setLabel('Prendre en charge')
              .setEmoji('✅')
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId(`ticket_close_${dbTicketId}`)
              .setLabel('Fermer')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

        await staffChannel.send({ embeds: [staffEmbed], components: [staffRow] });
      }
    }

    // 11. Réponse finale à l'utilisateur (on modifie le deferReply)
    await interaction.editReply({
      content: `✅ Votre ticket a été créé : <#${ticketChannel.id}>`,
      ephemeral: true
    });

    logger.info(`Ticket créé pour ${user.tag} (type: ${ticketType}) dans ${guild.name}`);

  } catch (error) {
    logger.error(`Erreur lors de la création du ticket pour ${user.tag}: ${error}`);
    console.error(error);

    // Si on a déjà deferred, on edit, sinon on reply
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [errorEmbed('Une erreur est survenue lors de la création du ticket.')],
        ephemeral: true
      });
    } else {
      await interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors de la création du ticket.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Gère la prise en charge d'un ticket par un staff
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} ticketId - L'ID du ticket en base de données
 */
async function claimTicket(interaction, ticketId) {
  const { guild, member, user } = interaction;

  try {
    // 1. Vérifier si l'utilisateur est staff
    const ticketConfig = db.get('SELECT staff_role_id FROM ticket_config WHERE guild_id = ?', [guild.id]);
    if (!ticketConfig || !ticketConfig.staff_role_id) {
       return interaction.reply({
         content: '❌ La configuration des tickets est incomplète (rôle staff manquant).',
         ephemeral: true
       });
    }

    if (!member.roles.cache.has(ticketConfig.staff_role_id)) {
      return interaction.reply({
        content: '❌ Vous n\'avez pas la permission de prendre en charge ce ticket.',
        ephemeral: true
      });
    }

    // 2. Récupérer le ticket
    const ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ce ticket n\'existe plus.',
        ephemeral: true
      });
    }

    if (ticket.status === 'claimed') {
      return interaction.reply({
        content: `❌ Ce ticket est déjà pris en charge par <@${ticket.staff_id}>.`,
        ephemeral: true
      });
    }

    if (ticket.status === 'closed') {
        return interaction.reply({
            content: '❌ Ce ticket est fermé.',
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    // 3. Mettre à jour la BDD
    db.run('UPDATE tickets SET staff_id = ?, status = ? WHERE id = ?', [user.id, 'claimed', ticketId]);

    // 4. Message dans le ticket
    const ticketChannel = guild.channels.cache.get(ticket.channel_id);
    if (ticketChannel) {
        // Ajouter les perms au staff s'il ne les a pas déjà via le rôle (par sécurité)
        // Mais normalement le rôle staff a déjà les perms

        const claimEmbed = createEmbed()
            .setTitle('✅ Ticket pris en charge')
            .setDescription(`${member} prend en charge ce ticket.`)
            .setColor(0x00ff00);

        await ticketChannel.send({ embeds: [claimEmbed] });
    }

    // 5. Mettre à jour la notification staff
    // On doit recréer l'embed original mais avec le champ "Staff assigné"
    // interaction.message est le message dans le salon staff
    const oldEmbed = interaction.message.embeds[0];

    // Recréation propre
    const newStaffEmbed = EmbedBuilder.from(oldEmbed);

    newStaffEmbed.addFields({ name: '👮 Staff assigné', value: `${member}`, inline: true });
    newStaffEmbed.setColor(0x00ff00); // Vert pour dire pris en charge

    // On garde le bouton fermer, mais on enlève claim
    const newRow = new ActionRowBuilder()
        .addComponents(
             new ButtonBuilder()
              .setCustomId(`ticket_close_${ticketId}`)
              .setLabel('Fermer')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
        );

    await interaction.message.edit({ embeds: [newStaffEmbed], components: [newRow] });

    // 6. Réponse éphémère
    await interaction.editReply({ content: '✅ Vous avez pris en charge ce ticket.' });
    logger.info(`Ticket #${ticketId} pris en charge par ${user.tag}`);

  } catch (error) {
    logger.error(`Erreur claimTicket: ${error}`);
    // Si deferred
    if (interaction.deferred) await interaction.editReply({ content: '❌ Une erreur est survenue.' });
    else await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
  }
}

/**
 * Demande confirmation pour fermer un ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string|null} ticketId - ID du ticket (null si cliqué depuis le salon du ticket)
 */
async function closeTicket(interaction, ticketId) {
    const { guild, user, member, channel } = interaction;

    try {
        let ticket;

        // Si ticketId est fourni (depuis panel staff)
        if (ticketId) {
            ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        } else {
            // Sinon on cherche via le channel_id
            ticket = db.get('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        }

        if (!ticket) {
            return interaction.reply({ content: '❌ Impossible de trouver le ticket associé.', ephemeral: true });
        }

        // Vérification des permissions (Créateur ou Staff)
        const ticketConfig = db.get('SELECT staff_role_id FROM ticket_config WHERE guild_id = ?', [guild.id]);
        const isStaff = ticketConfig && member.roles.cache.has(ticketConfig.staff_role_id);
        const isCreator = user.id === ticket.user_id;

        if (!isStaff && !isCreator) {
             return interaction.reply({ content: '❌ Vous n\'avez pas la permission de fermer ce ticket.', ephemeral: true });
        }

        // Envoyer le message de confirmation
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_confirm_close_${ticket.id}`)
              .setLabel('Confirmer')
              .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
              .setCustomId('ticket_cancel_close')
              .setLabel('Annuler')
              .setStyle(ButtonStyle.Secondary)
          );

        await interaction.reply({
            content: '❓ Êtes-vous sûr de vouloir fermer ce ticket ?',
            components: [row],
            ephemeral: false // Visible publiquement pour le contexte
        });

    } catch (error) {
        logger.error(`Erreur closeTicket: ${error}`);
        if (!interaction.replied) await interaction.reply({ content: '❌ Erreur.', ephemeral: true });
    }
}

/**
 * Confirme la fermeture du ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} ticketId
 */
async function confirmCloseTicket(interaction, ticketId) {
    const { guild, user } = interaction;

    try {
        const ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        if (!ticket) {
             return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });
        }

        if (ticket.status === 'closed') {
             return interaction.reply({ content: '❌ Ce ticket est déjà fermé.', ephemeral: true });
        }

        await interaction.deferUpdate(); // Acknowledge button click

        // Update DB
        db.run('UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?', ['closed', ticketId]);

        // Message in ticket channel
        const ticketChannel = guild.channels.cache.get(ticket.channel_id);
        if (ticketChannel) {
             // Génération et envoi du transcript
             try {
                const htmlBuffer = await generateTranscript(ticketChannel, ticket, guild);
                const ticketConfig = db.get('SELECT log_channel_id FROM ticket_config WHERE guild_id = ?', [guild.id]);

                if (ticketConfig && ticketConfig.log_channel_id) {
                    const logChannel = guild.channels.cache.get(ticketConfig.log_channel_id);
                    if (logChannel) {
                        const creator = await guild.members.fetch(ticket.user_id).catch(() => null);
                        const staff = ticket.staff_id ? await guild.members.fetch(ticket.staff_id).catch(() => null) : null;

                        const logEmbed = new EmbedBuilder()
                            .setColor(0x780CED)
                            .setTitle('📋 Transcript de Ticket')
                            .addFields(
                                { name: '🎫 Ticket', value: `#${ticket.id.toString().padStart(4, '0')}`, inline: true },
                                { name: '👤 Créateur', value: creator ? creator.user.tag : 'Inconnu', inline: true },
                                { name: '📝 Type', value: ticket.category || 'Inconnu', inline: true },
                                { name: '✅ Staff', value: staff ? staff.user.tag : 'Non assigné', inline: true },
                                { name: '📅 Créé le', value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`, inline: true },
                                { name: '🔒 Fermé le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                                { name: '📄 Raison', value: 'Fermé par le staff ou l\'utilisateur', inline: false }
                            )
                            .setTimestamp();

                        const attachment = new AttachmentBuilder(htmlBuffer, {
                            name: `transcript-ticket-${ticket.id}-${Date.now()}.html`
                        });

                        await logChannel.send({
                            embeds: [logEmbed],
                            files: [attachment]
                        });
                        logger.info(`Transcript ticket #${ticket.id} envoyé dans ${logChannel.name}`);
                    }
                }
             } catch (err) {
                 logger.error(`Erreur lors de l'envoi du transcript : ${err}`);
             }

             const closeEmbed = createEmbed()
                .setTitle('🔒 Ticket fermé')
                .setDescription(`Ce ticket a été fermé par ${interaction.member}.
Le salon sera supprimé dans 10 secondes.`)
                .setColor(0xff0000);

             await ticketChannel.send({ embeds: [closeEmbed] });

             // Schedule delete
             setTimeout(() => {
                 ticketChannel.delete('Ticket fermé').catch(e => logger.warn(`Impossible de supprimer le salon ${ticket.channel_id}: ${e.message}`));
             }, 10000);
        }

        // Update interaction message
        await interaction.editReply({ content: '🔒 Fermeture confirmée.', components: [] });

        logger.info(`Ticket #${ticketId} fermé par ${user.tag}`);

    } catch (error) {
        logger.error(`Erreur confirmCloseTicket: ${error}`);
    }
}

/**
 * Annule la fermeture du ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function cancelCloseTicket(interaction) {
    await interaction.update({ content: '❌ Fermeture annulée.', components: [] });
}

module.exports = {
    createTicket,
    claimTicket,
    closeTicket,
    confirmCloseTicket,
    cancelCloseTicket
};
