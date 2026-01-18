/**
 * Commande /botinfo
 * Affiche les informations sur le bot
 */

const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const { version } = require('../../../package.json');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Affiche les informations sur le bot'),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const client = interaction.client;

    // Calcul de l'uptime
    const uptime = client.uptime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const minutes = Math.floor(uptime / 60000) % 60;
    const seconds = Math.floor(uptime / 1000) % 60;

    const uptimeString = `${days}j ${hours}h ${minutes}m ${seconds}s`;

    // Nombre de membres total
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    const embed = createEmbed()
      .setTitle('ℹ️ Informations du Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Identité', value: `**Nom:** ${client.user.username}\n**Tag:** ${client.user.tag}\n**ID:** ${client.user.id}`, inline: true },
        { name: 'Technique', value: `**Version:** v${version}\n**Discord.js:** v${djsVersion}\n**Node.js:** ${process.version}`, inline: true },
        { name: 'Statistiques', value: `**Serveurs:** ${client.guilds.cache.size}\n**Utilisateurs:** ${totalMembers}\n**Commandes:** ${client.commands.size}\n**Uptime:** ${uptimeString}`, inline: false },
        { name: 'Système', value: `**Plateforme:** ${os.platform()} (${os.release()})\n**Mémoire:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
