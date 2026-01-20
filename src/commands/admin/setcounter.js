const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { updateMemberCounter } = require('../../utils/memberCounter');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcounter')
    .setDescription('Configure le salon utilisé pour le compteur de membres')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon vocal à utiliser')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // ✅ Déférer la réponse si traitement long
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('salon');

    // Vérification supplémentaire (bien que addChannelTypes filtre déjà dans l'UI)
    if (channel.type !== ChannelType.GuildVoice) {
      return interaction.editReply({
        embeds: [errorEmbed('Ce salon n\'est pas un salon vocal.')]
      });
    }

    // Vérifier les permissions du bot sur le salon
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        embeds: [errorEmbed('Je n\'ai pas la permission de gérer ce salon (Manage Channels).')]
      });
    }

    try {
      // Vérifier si une config existe déjà
      const existingConfig = db.get('SELECT * FROM counter_config WHERE guild_id = ?', [interaction.guild.id]);

      if (existingConfig) {
        // Mise à jour
        db.run('UPDATE counter_config SET channel_id = ? WHERE guild_id = ?', [channel.id, interaction.guild.id]);
      } else {
        // Création
        db.run('INSERT INTO counter_config (guild_id, channel_id) VALUES (?, ?)', [interaction.guild.id, channel.id]);
      }

      // Forcer la mise à jour immédiate
      await updateMemberCounter(interaction.guild, true);

      await interaction.editReply({
        embeds: [successEmbed(`Compteur configuré sur le salon ${channel} !`)]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Une erreur est survenue lors du configuration du compteur.')]
      });
    }
  },
};
