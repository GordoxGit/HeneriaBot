const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouiller le salon actuel ou un salon spécifié.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Le salon à déverrouiller (optionnel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel.permissionOverwrites) {
        return interaction.reply({ content: '❌ Ce type de salon ne peut pas être déverrouillé via cette commande.', ephemeral: true });
    }

    try {
      // Set SendMessages to null to inherit permissions (usually means enabled if not denied elsewhere)
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null
      });

      const message = '🔓 Salon déverrouillé.';

      if (targetChannel.id === interaction.channel.id) {
          await interaction.reply({ content: message });
      } else {
          await interaction.reply({ content: `✅ ${targetChannel} a été déverrouillé.`, ephemeral: true });
          await targetChannel.send({ content: message });
      }

      await logGeneralAction(interaction.guild, interaction.user, 'UNLOCK', 'Salon déverrouillé', targetChannel);

    } catch (error) {
      console.error(error);
      const replyContent = `❌ Erreur lors du déverrouillage : ${error.message}`;
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: replyContent, ephemeral: true });
      } else {
          await interaction.reply({ content: replyContent, ephemeral: true });
      }
    }
  }
};
