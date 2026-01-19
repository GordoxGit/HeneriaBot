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
    .setDescription('Configuration du système de tickets')
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
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'setup') {
      await this.handleSetup(interaction);
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
