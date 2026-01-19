/**
 * Commande /ticket
 * Gestion du système de tickets
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configuration et gestion du système de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurer le système de tickets et créer le panel')
        .addChannelOption(option =>
          option.setName('panel_channel')
            .setDescription('Salon où afficher le panel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('staff_channel')
            .setDescription('Salon de notification staff')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('log_channel')
            .setDescription('Salon des transcripts')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('staff_role')
            .setDescription('Rôle staff')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('help_category')
            .setDescription('Catégorie pour tickets Aide')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('report_category')
            .setDescription('Catégorie pour tickets Signalement')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('partnership_category')
            .setDescription('Catégorie pour tickets Partenariat')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('bug_category')
            .setDescription('Catégorie pour tickets Bug Bot')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('add')
        .setDescription('Ajouter un utilisateur au ticket')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur à ajouter').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Retirer un utilisateur du ticket')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur à retirer').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('rename')
        .setDescription('Renommer le ticket')
        .addStringOption(option => option.setName('name').setDescription('Nouveau nom').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand.setName('transfer')
        .setDescription('Transférer le ticket à un autre staff')
        .addUserOption(option => option.setName('staff').setDescription('Nouveau staff responsable').setRequired(true))
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup': return this.handleSetup(interaction);
      case 'add': return this.handleAdd(interaction);
      case 'remove': return this.handleRemove(interaction);
      case 'rename': return this.handleRename(interaction);
      case 'transfer': return this.handleTransfer(interaction);
    }
  },

  /**
   * Vérifie si l'interaction a lieu dans un ticket et si l'utilisateur est staff
   */
  async checkTicketAndStaff(interaction) {
    const { guild, channel, member } = interaction;

    // 1. Vérifier si on est dans un ticket
    const ticket = db.get('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
    if (!ticket) {
      await interaction.reply({
        embeds: [errorEmbed('Cette commande ne peut être utilisée que dans un salon de ticket.')],
        ephemeral: true
      });
      return null;
    }

    if (ticket.status === 'closed') {
      await interaction.reply({
        embeds: [errorEmbed('Ce ticket est déjà fermé.')],
        ephemeral: true
      });
      return null;
    }

    // 2. Vérifier si l'utilisateur est staff
    const config = db.get('SELECT staff_role_id FROM ticket_config WHERE guild_id = ?', [guild.id]);

    // Si l'utilisateur a la perm Admin, on laisse passer, sinon on vérifie le rôle staff
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = config && member.roles.cache.has(config.staff_role_id);

    if (!isAdmin && !isStaff) {
      await interaction.reply({
        embeds: [errorEmbed('Vous n\'avez pas la permission de gérer ce ticket.')],
        ephemeral: true
      });
      return null;
    }

    return { ticket, config }; // Retourne aussi la config pour usage ultérieur
  },

  /**
   * Ajoute un utilisateur au ticket
   */
  async handleAdd(interaction) {
    const context = await this.checkTicketAndStaff(interaction);
    if (!context) return;

    const targetUser = interaction.options.getUser('user');

    try {
      await interaction.channel.permissionOverwrites.create(targetUser, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true
      });

      await interaction.reply({ embeds: [successEmbed(`${targetUser} a été ajouté au ticket.`)] });
    } catch (error) {
      logger.error(`Erreur handleAdd: ${error}`);
      await interaction.reply({ embeds: [errorEmbed('Impossible d\'ajouter l\'utilisateur.')], ephemeral: true });
    }
  },

  /**
   * Retire un utilisateur du ticket
   */
  async handleRemove(interaction) {
    const context = await this.checkTicketAndStaff(interaction);
    if (!context) return;

    const targetUser = interaction.options.getUser('user');

    // On évite de retirer le créateur du ticket ou le staff responsable ?
    // Le prompt ne spécifie pas, mais c'est mieux.
    // "Retire un utilisateur du ticket"

    try {
      await interaction.channel.permissionOverwrites.delete(targetUser);

      await interaction.reply({ embeds: [successEmbed(`${targetUser} a été retiré du ticket.`)] });
    } catch (error) {
      logger.error(`Erreur handleRemove: ${error}`);
      await interaction.reply({ embeds: [errorEmbed('Impossible de retirer l\'utilisateur.')], ephemeral: true });
    }
  },

  /**
   * Renomme le salon du ticket
   */
  async handleRename(interaction) {
    const context = await this.checkTicketAndStaff(interaction);
    if (!context) return;

    const newName = interaction.options.getString('name');

    try {
      await interaction.channel.setName(newName);
      await interaction.reply({ embeds: [successEmbed(`Le ticket a été renommé en : **${newName}**`)] });
    } catch (error) {
      logger.error(`Erreur handleRename: ${error}`);
      // Discord limite les renommages (2 par 10min)
      if (error.code === 50035) { // Invalid Form Body (souvent rate limit ou caractères interdits) or similar
         return interaction.reply({ embeds: [errorEmbed('Impossible de renommer (limite de 2 changements/10min ou nom invalide).')], ephemeral: true });
      }
      await interaction.reply({ embeds: [errorEmbed('Une erreur est survenue lors du renommage.')], ephemeral: true });
    }
  },

  /**
   * Transfère le ticket à un autre staff
   */
  async handleTransfer(interaction) {
    const context = await this.checkTicketAndStaff(interaction);
    if (!context) return;
    const { ticket, config } = context;

    const targetStaff = interaction.options.getUser('staff');
    const targetMember = await interaction.guild.members.fetch(targetStaff.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({ embeds: [errorEmbed('Utilisateur introuvable.')], ephemeral: true });
    }

    // Vérifier que le nouveau staff a le rôle staff
    const staffRoleId = config ? config.staff_role_id : null;
    const isTargetStaff = staffRoleId && targetMember.roles.cache.has(staffRoleId);
    const isTargetAdmin = targetMember.permissions.has(PermissionFlagsBits.Administrator);

    if (!isTargetStaff && !isTargetAdmin) {
        return interaction.reply({ embeds: [errorEmbed(`${targetStaff} n'est pas membre du staff.`)], ephemeral: true });
    }

    try {
        // Update BDD
        db.run('UPDATE tickets SET staff_id = ? WHERE id = ?', [targetStaff.id, ticket.id]);

        // Envoyer message
        const transferEmbed = new EmbedBuilder()
            .setColor(0x780CED)
            .setTitle('🔄 Ticket transféré')
            .setDescription(`Ce ticket a été transféré à ${targetStaff}.`);

        await interaction.reply({ embeds: [transferEmbed] });

        // Ajouter les perms au nouveau staff si nécessaire
        await interaction.channel.permissionOverwrites.edit(targetStaff, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageMessages: true
        });

    } catch (error) {
        logger.error(`Erreur handleTransfer: ${error}`);
        await interaction.reply({ embeds: [errorEmbed('Erreur lors du transfert du ticket.')], ephemeral: true });
    }
  },

  /**
   * Gère la sous-commande setup
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async handleSetup(interaction) {
    await interaction.deferReply();

    const panelChannel = interaction.options.getChannel('panel_channel');
    const staffChannel = interaction.options.getChannel('staff_channel');
    const logChannel = interaction.options.getChannel('log_channel');
    const staffRole = interaction.options.getRole('staff_role');

    const helpCategory = interaction.options.getChannel('help_category');
    const reportCategory = interaction.options.getChannel('report_category');
    const partnershipCategory = interaction.options.getChannel('partnership_category');
    const bugCategory = interaction.options.getChannel('bug_category');

    // Validation des permissions du bot
    if (!panelChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({ embeds: [errorEmbed(`Je n'ai pas la permission d'envoyer des messages dans ${panelChannel}`)] });
    }

    const categoriesToCheck = [helpCategory, reportCategory, partnershipCategory, bugCategory];
    for (const cat of categoriesToCheck) {
      if (!cat.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({ embeds: [errorEmbed(`Je n'ai pas la permission de gérer les salons dans la catégorie ${cat}`)] });
      }
    }

    try {
      // 1. Créer l'embed et les boutons
      const panelEmbed = new EmbedBuilder()
        .setColor(0x780CED) // Violet Heneria
        .setTitle('🎫 Système de Tickets - Heneria')
        .setDescription(`Besoin d'aide ? Un problème à signaler ?

Cliquez sur l'un des boutons ci-dessous pour ouvrir un ticket.
Un membre du staff vous répondra dès que possible.

**Types de tickets disponibles :**
🆘 **Besoin d'aide** - Questions générales et support
🚨 **Signalement** - Signaler un joueur ou un comportement
🤝 **Partenariat** - Candidatures staff ou partenariats
🐛 **Bug Bot** - Signaler un bug du bot Discord`)
        .setFooter({ text: 'Heneria • Système de Tickets' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_help')
            .setLabel('Besoin d\'aide')
            .setEmoji('🆘')
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId('ticket_report')
            .setLabel('Signalement')
            .setEmoji('🚨')
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId('ticket_partnership')
            .setLabel('Partenariat')
            .setEmoji('🤝')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId('ticket_bug')
            .setLabel('Bug Bot')
            .setEmoji('🐛')
            .setStyle(ButtonStyle.Secondary)
        );

      // Envoyer le panel
      const panelMessage = await panelChannel.send({ embeds: [panelEmbed], components: [row] });

      // 2. Enregistrer la configuration globale
      db.run(`
        INSERT INTO ticket_config (guild_id, panel_channel_id, panel_message_id, staff_channel_id, log_channel_id, staff_role_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
          panel_channel_id = excluded.panel_channel_id,
          panel_message_id = excluded.panel_message_id,
          staff_channel_id = excluded.staff_channel_id,
          log_channel_id = excluded.log_channel_id,
          staff_role_id = excluded.staff_role_id
      `, [
        interaction.guild.id,
        panelChannel.id,
        panelMessage.id,
        staffChannel.id,
        logChannel.id,
        staffRole.id
      ]);

      // 3. Enregistrer les catégories
      // D'abord supprimer les anciennes pour ce serveur
      db.run('DELETE FROM ticket_categories WHERE guild_id = ?', [interaction.guild.id]);

      // Insérer les nouvelles
      const categories = [
        { id: helpCategory.id, emoji: '🆘', label: 'Besoin d\'aide', type: 'help' },
        { id: reportCategory.id, emoji: '🚨', label: 'Signalement', type: 'report' },
        { id: partnershipCategory.id, emoji: '🤝', label: 'Partenariat', type: 'partnership' },
        { id: bugCategory.id, emoji: '🐛', label: 'Bug Bot', type: 'bug' }
      ];

      for (const cat of categories) {
        db.run(`
          INSERT INTO ticket_categories (guild_id, category_id, emoji, label, type)
          VALUES (?, ?, ?, ?, ?)
        `, [interaction.guild.id, cat.id, cat.emoji, cat.label, cat.type]);
      }

      logger.info(`Système de tickets configuré pour le serveur ${interaction.guild.name} (${interaction.guild.id})`);

      await interaction.editReply({
        embeds: [successEmbed(`✅ Système de tickets configuré avec succès !

Panel envoyé dans : ${panelChannel}
Notifications staff dans : ${staffChannel}
Logs dans : ${logChannel}
Rôle Staff : ${staffRole}`)]
      });

    } catch (error) {
      logger.error(`Erreur lors du setup tickets : ${error}`);
      await interaction.editReply({
        embeds: [errorEmbed('Une erreur est survenue lors de la configuration.')]
      });
    }
  }
};
