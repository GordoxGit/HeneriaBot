const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topvoters')
        .setDescription('Afficher le classement des meilleurs voteurs')
        .addStringOption(option =>
            option.setName('periode')
                .setDescription('Période du classement')
                .addChoices(
                    { name: 'Ce mois', value: 'monthly' },
                    { name: 'Tout temps', value: 'alltime' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const periode = interaction.options.getString('periode') || 'monthly';

        let query, title;
        if (periode === 'monthly') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            query = db.all(`
                SELECT user_id, COUNT(*) as votes
                FROM user_votes
                WHERE guild_id = ? AND voted_at >= ? AND rewards_given = 1
                GROUP BY user_id
                ORDER BY votes DESC
                LIMIT 15
            `, [guildId, Math.floor(startOfMonth.getTime() / 1000)]);
            title = '🏆 Top Voteurs du Mois';
        } else {
            query = db.all(`
                SELECT user_id, total_votes as votes
                FROM vote_stats
                WHERE guild_id = ?
                ORDER BY total_votes DESC
                LIMIT 15
            `, [guildId]);
            title = '🏆 Top Voteurs (Tout Temps)';
        }

        if (query.length === 0) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.WARNING)
                    .setDescription('Aucun vote enregistré pour cette période.')
                ]
            });
        }

        const medals = ['🥇', '🥈', '🥉'];
        let description = '';

        for (let i = 0; i < query.length; i++) {
            const entry = query[i];
            const medal = medals[i] || `**${i + 1}.**`;

            try {
                const user = await interaction.client.users.fetch(entry.user_id);
                description += `${medal} ${user.username} — **${entry.votes}** votes\n`;
            } catch {
                description += `${medal} <@${entry.user_id}> — **${entry.votes}** votes\n`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: 'Continuez à voter pour grimper dans le classement !' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
