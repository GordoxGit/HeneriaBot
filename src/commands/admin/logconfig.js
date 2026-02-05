const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

const EVENT_TYPES = ['MESSAGES', 'MEMBERS', 'MODERATION', 'VOICE'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('Configuration avancée des logs')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Définir un salon pour un type de log')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Le type d\'événement')
            .setRequired(true)
            .addChoices(...EVENT_TYPES.map(t => ({ name: t, value: t }))))
        .addChannelOption(opt =>
          opt.setName('salon')
            .setDescription('Le salon de destination')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Activer ou désactiver un type de log')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Le type d\'événement')
            .setRequired(true)
            .addChoices(...EVENT_TYPES.map(t => ({ name: t, value: t })))))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Voir la configuration actuelle'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'set') {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('salon');

      // Vérifier les permissions du bot dans ce salon
      if (!channel.viewable || !channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${channel}.`,
          flags: MessageFlags.Ephemeral
        });
      }

      try {
        db.run(
          `INSERT INTO logs_config (guild_id, event_type, channel_id, is_active)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(guild_id, event_type) DO UPDATE SET channel_id = excluded.channel_id, is_active = 1`,
          [guildId, type, channel.id]
        );

        return interaction.reply({
          content: `✅ Logs **${type}** configurés sur ${channel}.`,
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        return interaction.reply({
          content: `❌ Erreur BDD: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'toggle') {
      const type = interaction.options.getString('type');

      try {
        const current = db.get('SELECT is_active FROM logs_config WHERE guild_id = ? AND event_type = ?', [guildId, type]);

        if (!current) {
             return interaction.reply({
              content: `❌ Aucun salon configuré pour **${type}**. Utilisez \`/logconfig set\` d'abord.`,
              flags: MessageFlags.Ephemeral
            });
        }

        const newState = current.is_active ? 0 : 1;
        db.run('UPDATE logs_config SET is_active = ? WHERE guild_id = ? AND event_type = ?', [newState, guildId, type]);

        return interaction.reply({
          content: `✅ Logs **${type}** ${newState ? 'activés' : 'désactivés'}.`,
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
         return interaction.reply({
          content: `❌ Erreur BDD: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'view') {
       const configs = db.all('SELECT * FROM logs_config WHERE guild_id = ?', [guildId]);

       const embed = new EmbedBuilder()
         .setTitle('📜 Configuration des Logs')
         .setColor(COLORS?.INFO || 0x0099ff)
         .setDescription(configs.length === 0 ? "Aucune configuration." : null);

       EVENT_TYPES.forEach(type => {
         const conf = configs.find(c => c.event_type === type);
         const status = conf?.is_active ? '✅ Actif' : '❌ Inactif';
         const channel = conf ? `<#${conf.channel_id}>` : 'Non défini';

         embed.addFields({ name: type, value: `${status} | ${channel}`, inline: false });
       });

       return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};
