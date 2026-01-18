/**
 * Commande /avatar
 * Affiche l'avatar d'un utilisateur en haute résolution
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Affiche l'avatar d'un utilisateur")
    .addUserOption(option =>
      option.setName('user')
        .setDescription("L'utilisateur dont vous voulez voir l'avatar")
        .setRequired(false)),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    // Liens de téléchargement
    const png = user.displayAvatarURL({ extension: 'png', size: 1024 });
    const jpg = user.displayAvatarURL({ extension: 'jpg', size: 1024 });
    const webp = user.displayAvatarURL({ extension: 'webp', size: 1024 });

    const embed = createEmbed()
      .setTitle(`Avatar de ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setDescription(`**Télécharger :** [PNG](${png}) | [JPG](${jpg}) | [WebP](${webp})`);

    await interaction.reply({ embeds: [embed] });
  },
};
