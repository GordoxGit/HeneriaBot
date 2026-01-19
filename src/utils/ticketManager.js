/**
 * Gestionnaire de tickets
 * Gère la création, la fermeture et la gestion des tickets
 */

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const db = require('../database/db');
const { createEmbed, errorEmbed } = require('./embedBuilder');
const logger = require('./logger');

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

    const ticketMessage = await ticketChannel.send({
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

module.exports = { createTicket };
