/**
 * Commande /uptime
 * Affiche la durée de fonctionnement du bot
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Affiche la durée de fonctionnement du bot'),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const client = interaction.client;
    const uptime = client.uptime;

    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const minutes = Math.floor(uptime / 60000) % 60;
    const seconds = Math.floor(uptime / 1000) % 60;

    const uptimeString = `${days} jours, ${hours} heures, ${minutes} minutes, ${seconds} secondes`;

    // Calcul de la date de démarrage
    const startTime = Math.floor((Date.now() - uptime) / 1000);

    const embed = createEmbed()
      .setTitle('⏱️ Temps de fonctionnement')
      .addFields(
        { name: 'Durée', value: uptimeString, inline: false },
        { name: 'Démarré le', value: `<t:${startTime}:F> (<t:${startTime}:R>)`, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
