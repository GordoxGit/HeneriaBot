const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Voir l\'historique des sanctions d\'un utilisateur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur dont vous voulez voir l\'historique')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guild.id;

    // Fetch infractions
    const infractions = db.all(
      `SELECT * FROM infractions WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC`,
      [guildId, targetUser.id]
    );

    // Calculate stats
    const stats = infractions.reduce((acc, inf) => {
      acc[inf.type] = (acc[inf.type] || 0) + 1;
      return acc;
    }, {});

    const statsString = Object.entries(stats)
      .map(([type, count]) => `**${type}**: ${count}`)
      .join(', ') || 'Casier vierge';

    // Get last 10
    const recentInfractions = infractions.slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle(`Historique : ${targetUser.tag}`)
      .setColor(COLORS.INFO)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(`Résumé : ${statsString}`)
      .setFooter({ text: `Total : ${infractions.length} sanctions` })
      .setTimestamp();

    if (recentInfractions.length > 0) {
      const fields = recentInfractions.map(inf => {
        const date = `<t:${inf.created_at}:d>`;
        return {
          name: `ID: ${inf.id} | ${inf.type} | ${date}`,
          value: `Mod: <@${inf.moderator_id}>\nRaison: ${inf.reason || 'N/A'}`
        };
      });
      embed.addFields(fields);
    } else {
      embed.addFields({ name: 'Aucune sanction', value: 'Cet utilisateur est clean !' });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
