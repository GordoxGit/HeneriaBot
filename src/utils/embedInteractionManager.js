const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const { COLORS } = require('../config/constants');
const { errorEmbed, successEmbed } = require('./embedBuilder');

/**
 * Construit la modale pour l'embed
 * @param {string} customId - ID de la modale
 * @param {string} title - Titre de la modale
 * @param {Object} data - Données pré-remplies (optionnel)
 */
function createEmbedModal(customId, modalTitle, data = {}) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(modalTitle);

  const titleInput = new TextInputBuilder()
    .setCustomId('embed_title')
    .setLabel("Titre")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(256);

  if (data.title) titleInput.setValue(data.title);

  const descInput = new TextInputBuilder()
    .setCustomId('embed_description')
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true); // Description souvent requise, ou mettre false

  if (data.description) descInput.setValue(data.description);

  const colorInput = new TextInputBuilder()
    .setCustomId('embed_color')
    .setLabel("Couleur (Hex, ex: #FF0000)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(7);

  if (data.color) colorInput.setValue(data.color);

  const imageInput = new TextInputBuilder()
    .setCustomId('embed_image')
    .setLabel("URL de l'image (Bannière)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  if (data.image) imageInput.setValue(data.image);

  const footerInput = new TextInputBuilder()
    .setCustomId('embed_footer')
    .setLabel("Footer (Pied de page)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048);

  if (data.footer) footerInput.setValue(data.footer);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(footerInput)
  );

  return modal;
}

/**
 * Extrait les données d'une soumission de modale et construit l'embed
 */
function buildEmbedFromModal(interaction) {
  const title = interaction.fields.getTextInputValue('embed_title');
  const description = interaction.fields.getTextInputValue('embed_description');
  const color = interaction.fields.getTextInputValue('embed_color') || COLORS.PRIMARY; // Default primary
  const image = interaction.fields.getTextInputValue('embed_image');
  const footer = interaction.fields.getTextInputValue('embed_footer');

  const embed = new EmbedBuilder()
    .setDescription(description || null);

  if (title) embed.setTitle(title);

  // Validation couleur
  const hexRegex = /^#?([0-9A-Fa-f]{6})$/;
  if (color && hexRegex.test(color)) {
    embed.setColor(color.startsWith('#') ? color : `#${color}`);
  } else {
    embed.setColor(COLORS.PRIMARY);
  }

  // Validation URL Image
  if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
    embed.setImage(image);
  }

  if (footer) embed.setFooter({ text: footer });

  // Timestamp auto
  embed.setTimestamp();

  return embed;
}

/**
 * Gère les soumissions de modales
 */
async function handleEmbedModal(interaction) {
  // Cas 1: Création initiale (/embed create)
  if (interaction.customId === 'embed_modal_create') {
    const embed = buildEmbedFromModal(interaction);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('embed_btn_send')
          .setLabel('Envoyer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('embed_btn_edit')
          .setLabel('Modifier')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('embed_btn_cancel')
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: 'Voici la prévisualisation de votre embed :',
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
  // Cas 2: Modification via le Wizard (Bouton Modifier -> Modale -> Update Preview)
  else if (interaction.customId === 'embed_modal_wizard_update') {
    const embed = buildEmbedFromModal(interaction);

    // On garde les mêmes boutons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('embed_btn_send')
          .setLabel('Envoyer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('embed_btn_edit')
          .setLabel('Modifier')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('embed_btn_cancel')
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.update({
      content: 'Prévisualisation mise à jour :',
      embeds: [embed],
      components: [row]
    });
  }
  // Cas 3: Édition directe d'un message existant (/embed edit)
  else if (interaction.customId.startsWith('embed_modal_edit_direct_')) {
    const parts = interaction.customId.split('_');
    const channelId = parts[4];
    const messageId = parts[5];

    try {
      const channel = await interaction.guild.channels.fetch(channelId);
      if (!channel) throw new Error("Salon introuvable");

      const message = await channel.messages.fetch(messageId);
      if (!message) throw new Error("Message introuvable");

      const newEmbed = buildEmbedFromModal(interaction);

      await message.edit({ embeds: [newEmbed] });
      await interaction.reply({ embeds: [successEmbed("L'embed a été mis à jour avec succès.")], ephemeral: true });

    } catch (error) {
      console.error(error);
      await interaction.reply({ embeds: [errorEmbed("Impossible de modifier le message : " + error.message)], ephemeral: true });
    }
  }
}

/**
 * Gère les boutons du Wizard
 */
async function handleEmbedButton(interaction) {
  if (interaction.customId === 'embed_btn_cancel') {
    await interaction.update({ content: 'Création annulée.', embeds: [], components: [] });
  }
  else if (interaction.customId === 'embed_btn_send') {
    const embed = interaction.message.embeds[0];
    try {
        await interaction.channel.send({ embeds: [embed] });
        await interaction.update({ content: '✅ Embed publié !', components: [] });
    } catch (error) {
        await interaction.followUp({ embeds: [errorEmbed("Erreur lors de l'envoi : " + error.message)], ephemeral: true });
    }
  }
  else if (interaction.customId === 'embed_btn_edit') {
    // Récupérer les données de l'embed actuel pour pré-remplir la modale
    const embed = interaction.message.embeds[0];

    // On doit reconstruire les données brutes car embed.color est un entier
    const colorHex = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '';

    const data = {
        title: embed.title,
        description: embed.description,
        color: colorHex,
        image: embed.image ? embed.image.url : null,
        footer: embed.footer ? embed.footer.text : null
    };

    const modal = createEmbedModal('embed_modal_wizard_update', 'Modifier l\'embed', data);
    await interaction.showModal(modal);
  }
}

module.exports = {
  createEmbedModal,
  handleEmbedModal,
  handleEmbedButton
};
