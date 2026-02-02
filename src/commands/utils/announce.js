const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { COLORS } = require('../../config/constants');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Faire une annonce officielle')
    .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone)
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où envoyer l\'annonce')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('titre')
        .setDescription('Le titre de l\'annonce')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le contenu de l\'annonce (utilisez \\n pour les sauts de ligne)')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Une image bannière pour l\'embed')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('mention')
        .setDescription('Mentionner tout le monde ?')
        .setRequired(false)
        .addChoices(
          { name: 'Aucune', value: 'none' },
          { name: '@everyone', value: 'everyone' },
          { name: '@here', value: 'here' }
        )),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('salon');
      const title = interaction.options.getString('titre');
      const rawMessage = interaction.options.getString('message');
      const image = interaction.options.getAttachment('image');
      const mention = interaction.options.getString('mention') || 'none';

      // Vérification des permissions du bot dans le salon cible
      if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          embeds: [errorEmbed(`Je n'ai pas la permission d'envoyer des messages dans ${channel}.`)],
          ephemeral: true
        });
      }

      // Construction du message
      // On remplace les \n littéraux par des vrais sauts de ligne si l'utilisateur a tapé "\n"
      const messageContent = rawMessage.replace(/\\n/g, '\n');

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(title)
        .setDescription(messageContent)
        .setFooter({ text: `Annonce par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (image) {
        embed.setImage(image.url);
      }

      let content = '';
      if (mention === 'everyone') content = '@everyone';
      if (mention === 'here') content = '@here';

      // Envoi du message
      await channel.send({ content: content || null, embeds: [embed] });

      // Confirmation
      await interaction.reply({
        embeds: [successEmbed(`Annonce envoyée avec succès dans ${channel} !`)],
        ephemeral: true
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors de l\'envoi de l\'annonce.')],
        ephemeral: true
      });
    }
  },
};
