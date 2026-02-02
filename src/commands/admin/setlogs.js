const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Configurer le salon de logs de modération')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où envoyer les logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('salon');

    // Vérifier les permissions du bot dans ce salon
    if (!targetChannel.viewable || !targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${targetChannel}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // Mise à jour en base de données
      // Utilisation de INSERT OR REPLACE pour gérer la contrainte UNIQUE(guild_id, key)
      db.run(
        `INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value`,
        [interaction.guild.id, 'mod_log_channel', targetChannel.id]
      );

      // Envoi du message de test
      const testEmbed = new EmbedBuilder()
        .setTitle('Configuration des logs')
        .setDescription('✅ Salon de logs configuré ici.')
        .setColor(COLORS.SUCCESS)
        .setTimestamp();

      await targetChannel.send({ embeds: [testEmbed] });

      return interaction.reply({
        content: `✅ Le salon de logs a été défini sur ${targetChannel}.`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Erreur lors de la configuration des logs :', error);
      return interaction.reply({
        content: `❌ Une erreur est survenue lors de la configuration : ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
