const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createEmbedModal } = require('../../utils/embedInteractionManager');
const { errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Générateur d\'embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Créer un nouvel embed (Assistant interactif)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Modifier un embed existant')
        .addChannelOption(option =>
          option.setName('salon')
            .setDescription('Le salon où se trouve le message')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true))
        .addStringOption(option =>
          option.setName('message_id')
            .setDescription('L\'ID du message à modifier')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const modal = createEmbedModal('embed_modal_create', 'Créer un nouvel Embed');
      await interaction.showModal(modal);
    }
    else if (subcommand === 'edit') {
      const channel = interaction.options.getChannel('salon');
      const messageId = interaction.options.getString('message_id');

      try {
        // Vérification des permissions du bot dans le salon cible
        if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ViewChannel)) {
            return interaction.reply({
                embeds: [errorEmbed(`Je n'ai pas accès à ce salon.`)],
                ephemeral: true
            });
        }

        const message = await channel.messages.fetch(messageId);

        if (!message) {
          return interaction.reply({
            embeds: [errorEmbed('Message introuvable.')],
            ephemeral: true
          });
        }

        if (message.author.id !== interaction.client.user.id) {
          return interaction.reply({
            embeds: [errorEmbed('Je ne peux modifier que mes propres messages.')],
            ephemeral: true
          });
        }

        if (message.embeds.length === 0) {
          return interaction.reply({
            embeds: [errorEmbed('Ce message ne contient pas d\'embed.')],
            ephemeral: true
          });
        }

        const embed = message.embeds[0];
        const colorHex = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '';

        const data = {
          title: embed.title,
          description: embed.description,
          color: colorHex,
          image: embed.image ? embed.image.url : null,
          footer: embed.footer ? embed.footer.text : null
        };

        const modal = createEmbedModal(`embed_modal_edit_direct_${channel.id}_${message.id}`, 'Modifier l\'Embed', data);
        await interaction.showModal(modal);

      } catch (error) {
        console.error(error);
        // Si le message n'est pas trouvé, fetch lance une erreur
        await interaction.reply({
            embeds: [errorEmbed('Message introuvable ou erreur technique.')],
            ephemeral: true
        });
      }
    }
  },
};
