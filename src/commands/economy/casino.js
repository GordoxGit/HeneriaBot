const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Commandes du Casino')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Voir les statistiques de jeu')
                .addUserOption(option =>
                    option.setName('utilisateur')
                        .setDescription('Utilisateur (optionnel)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'stats') {
            const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
            const guildId = interaction.guildId;

            const stats = db.all(
                `SELECT * FROM casino_stats WHERE user_id = ? AND guild_id = ?`,
                [targetUser.id, guildId]
            );

            if (!stats || stats.length === 0) {
                 return interaction.reply({
                    embeds: [createEmbed().setDescription(`${targetUser} n'a pas encore joué au casino.`)],
                    ephemeral: true
                 });
            }

            let totalPlayed = 0;
            let totalWagered = 0;
            let totalWon = 0;
            let favGame = { name: 'Aucun', count: 0 };

            for (const row of stats) {
                totalPlayed += row.games_played;
                totalWagered += row.total_wagered;
                totalWon += row.total_won;

                if (row.games_played > favGame.count) {
                    favGame = { name: row.game_type, count: row.games_played };
                }
            }

            const profit = totalWon - totalWagered;
            const profitStr = profit >= 0
                ? `+${profit} ${EMOJIS.CASINO.COIN}`
                : `${profit} ${EMOJIS.CASINO.COIN}`;

            const embed = createEmbed()
                .setTitle(`🎰 Statistiques Casino - ${targetUser.username}`)
                .setColor(COLORS.PRIMARY)
                .addFields(
                    { name: 'Parties Jouées', value: `${totalPlayed}`, inline: true },
                    { name: 'Jeu Favori', value: `${favGame.name} (${favGame.count})`, inline: true },
                    { name: 'Net Profit', value: profitStr, inline: true },
                    { name: 'Total Misé', value: `${totalWagered} ${EMOJIS.CASINO.COIN}`, inline: true },
                    { name: 'Total Gagné', value: `${totalWon} ${EMOJIS.CASINO.COIN}`, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.reply({ embeds: [embed] });
        }
    }
};
