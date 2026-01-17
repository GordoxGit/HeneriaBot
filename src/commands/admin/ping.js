/**
 * Commande /ping
 * Affiche la latence du bot
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Affiche la latence du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const embed = createEmbed()
      .setTitle('Pong! 🏓')
      .setDescription(`Latence du bot : **${interaction.client.ws.ping}ms**`);

    await interaction.reply({ embeds: [embed] });
  },
};
