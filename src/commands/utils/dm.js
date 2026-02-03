const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Envoyer un message privé à un utilisateur via le bot')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur à contacter')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le message à envoyer')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const messageContent = interaction.options.getString('message');

    const embed = new EmbedBuilder()
      .setTitle(`Message de l'administration de ${interaction.guild.name}`)
      .setDescription(messageContent)
      .setColor('#0099ff') // Couleur par défaut ou configurable
      .setFooter({ text: `Envoyé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    try {
      await user.send({ embeds: [embed] });
      await interaction.reply({ content: `Message envoyé avec succès à ${user.tag}.`, ephemeral: true });
    } catch (error) {
      // Erreur typique : DMs fermés ou utilisateur bloquant le bot
      await interaction.reply({ content: `❌ Impossible d'envoyer le MP à ${user.tag}. L'utilisateur a probablement désactivé ses messages privés.`, ephemeral: true });
    }
  },
};
