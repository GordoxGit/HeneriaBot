/**
 * Commande /banner
 * Affiche la bannière d'un utilisateur
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Affiche la bannière d'un utilisateur")
    .addUserOption(option =>
      option.setName('user')
        .setDescription("L'utilisateur dont vous voulez voir la bannière")
        .setRequired(false)),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    // Récupération de l'utilisateur complet pour avoir la bannière
    // .fetch(true) force la récupération depuis l'API
    const user = await targetUser.fetch(true);

    if (!user.banner) {
       const embed = createEmbed()
         .setTitle(`Bannière de ${user.username}`)
         .setDescription("Cet utilisateur n'a pas de bannière.");
       return interaction.reply({ embeds: [embed] });
    }

    const bannerUrl = user.bannerURL({ size: 1024, dynamic: true });

    const embed = createEmbed()
      .setTitle(`Bannière de ${user.username}`)
      .setImage(bannerUrl)
      .setDescription(`**Lien de téléchargement :** [Cliquez ici](${bannerUrl})`);

    await interaction.reply({ embeds: [embed] });
  },
};
