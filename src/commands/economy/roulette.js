const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const { updateCasinoStats, ROULETTE } = require('../../utils/casinoUtils');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Jouer à la roulette')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Le montant à parier')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('choix')
                .setDescription('Rouge, Noir, Pair, Impair, ou un nombre (0-36)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const wager = interaction.options.getInteger('mise');
        const choiceRaw = interaction.options.getString('choix').toLowerCase();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 1. Validate Input
        let betType = null; // 'color', 'parity', 'number'
        let betValue = null; // 'red', 'black', 'even', 'odd', or int

        if (['rouge', 'red'].includes(choiceRaw)) {
            betType = 'color'; betValue = 'red';
        } else if (['noir', 'black'].includes(choiceRaw)) {
            betType = 'color'; betValue = 'black';
        } else if (['pair', 'even'].includes(choiceRaw)) {
            betType = 'parity'; betValue = 'even';
        } else if (['impair', 'odd'].includes(choiceRaw)) {
            betType = 'parity'; betValue = 'odd';
        } else {
            const num = parseInt(choiceRaw);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                betType = 'number'; betValue = num;
            } else {
                return interaction.reply({
                    embeds: [errorEmbed("Choix invalide. Options: Rouge, Noir, Pair, Impair, 0-36.")],
                    ephemeral: true
                });
            }
        }

        if (wager > MAX_BET) {
             return interaction.reply({
                embeds: [errorEmbed(`La mise maximale est de **${MAX_BET}** ${EMOJIS.CASINO.COIN}.`)],
                ephemeral: true
            });
        }

        // 2. Transaction
        let balanceError = null;
        try {
            db.transaction(() => {
                const wallet = db.get(`SELECT cash FROM wallets WHERE user_id = ? AND guild_id = ?`, [userId, guildId]);
                if (!wallet || wallet.cash < wager) {
                    balanceError = "Fonds insuffisants.";
                    return;
                }
                db.run(`UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?`, [wager, userId, guildId]);
                db.run(`INSERT INTO economy_transactions (from_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`, [userId, guildId, wager, 'CASINO_BET']);
            })();
        } catch (error) {
            console.error(error);
            return interaction.reply({ embeds: [errorEmbed("Erreur transaction.")], ephemeral: true });
        }

        if (balanceError) return interaction.reply({ embeds: [errorEmbed(balanceError)], ephemeral: true });

        // 3. Animation
        const spinEmbed = createEmbed()
            .setTitle('🎰 Roulette')
            .setDescription(`La bille tourne...\nChoix : **${choiceRaw}**\nMise : **${wager}** ${EMOJIS.CASINO.COIN}`)
            .setColor(COLORS.PRIMARY);

        await interaction.reply({ embeds: [spinEmbed] });

        // Simulate wait
        await new Promise(r => setTimeout(r, 2000));

        // 4. Result
        const resultNum = Math.floor(Math.random() * 37); // 0-36
        const resultColor = ROULETTE.getColor(resultNum);
        const resultParity = resultNum === 0 ? 'none' : (resultNum % 2 === 0 ? 'even' : 'odd');

        let won = false;
        let multiplier = 0;

        if (betType === 'number') {
            if (resultNum === betValue) {
                won = true;
                multiplier = 36;
            }
        } else if (betType === 'color') {
            if (resultColor === betValue) {
                won = true;
                multiplier = 2;
            }
        } else if (betType === 'parity') {
            if (resultParity === betValue) {
                won = true;
                multiplier = 2;
            }
        }

        const winnings = won ? wager * multiplier : 0;

        // Payout
        if (won) {
             try {
                 db.transaction(() => {
                    db.run(`UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`, [winnings, userId, guildId]);
                    db.run(`INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`, [userId, guildId, winnings, 'CASINO_WIN']);
                 })();
            } catch (e) {
                console.error("Roulette Payout Error", e);
            }
        }

        updateCasinoStats(userId, guildId, 'roulette', wager, winnings);

        // Final Embed
        const colorEmoji = resultColor === 'red' ? '🔴' : (resultColor === 'black' ? '⚫' : '🟢');

        const resultEmbed = createEmbed()
            .setTitle('🎰 Roulette - Résultat')
            .setColor(won ? COLORS.SUCCESS : COLORS.ERROR)
            .setDescription(`## ${colorEmoji} ${resultNum}\n\n` +
                            (won
                                ? `🎉 **GAGNÉ !**\nVous avez misé sur **${choiceRaw}**.\nGain : **${winnings}** ${EMOJIS.CASINO.COIN}`
                                : `❌ **PERDU...**\nLa bille s'est arrêtée sur **${resultNum}** (${resultColor}).`));

        await interaction.editReply({ embeds: [resultEmbed] });
    }
};
