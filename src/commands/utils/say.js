const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Fait parler le bot')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le message à envoyer')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Le salon où envoyer le message (optionnel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const messageContent = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    // Sécurité : Empêcher les mentions abusives
    const safeContent = messageContent.replace(/@(everyone|here)/g, '@\u200b$1');

    try {
      await targetChannel.send(safeContent);

      // Si on est dans le même salon, on confirme de manière éphémère
      await interaction.reply({ content: 'Message envoyé !', ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `Erreur lors de l'envoi du message : ${error.message}`, ephemeral: true });
    }
  },
};
