const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listvotes')
    .setDescription('Lister tous les sites de vote configurés')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const guildId = interaction.guild.id;

    try {
      const sites = db.all(
        'SELECT * FROM vote_sites WHERE guild_id = ? ORDER BY position ASC',
        [guildId]
      );

      const embed = new EmbedBuilder()
        .setColor(0x780CED)
        .setTitle('📋 Liste des sites de vote')
        .setFooter({ text: `${sites.length} site(s) configuré(s)` });

      if (sites.length > 0) {
        const description = sites.map((site, i) => {
          const status = site.enabled ? '✅' : '❌';
          return `${i + 1}. ${status} **${site.name}**\n   [Lien](${site.url})`;
        }).join('\n\n');

        embed.setDescription(description);
      } else {
        embed.setDescription('Aucun site de vote configuré.');
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors de la récupération des sites de vote.');

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
