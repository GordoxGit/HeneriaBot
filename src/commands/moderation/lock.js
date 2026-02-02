const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouiller le salon actuel ou un salon spécifié.')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Le salon à verrouiller (optionnel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel.permissionOverwrites) {
        return interaction.reply({ content: '❌ Ce type de salon ne peut pas être verrouillé via cette commande (pas de permissions gérables).', ephemeral: true });
    }

    try {
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });

      const message = '🔒 Salon verrouillé par la modération.';

      if (targetChannel.id === interaction.channel.id) {
          await interaction.reply({ content: message });
      } else {
          await interaction.reply({ content: `✅ ${targetChannel} a été verrouillé.`, ephemeral: true });
          await targetChannel.send({ content: message });
      }

      await logGeneralAction(interaction.guild, interaction.user, 'LOCK', 'Salon verrouillé', targetChannel);

    } catch (error) {
      console.error(error);
      const replyContent = `❌ Erreur lors du verrouillage : ${error.message}`;
      if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: replyContent, ephemeral: true });
      } else {
          await interaction.reply({ content: replyContent, ephemeral: true });
      }
    }
  }
};
