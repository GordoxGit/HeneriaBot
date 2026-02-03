const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const { activeGames, updateCasinoStats } = require('../../utils/casinoUtils');
const EMOJIS = require('../../utils/emojis');

function getCrashPoint() {
    // 3% chance of instant crash (1.00x)
    if (Math.random() < 0.03) return 1.00;

    // Standard inverse distribution
    const multiplier = 1 / (1 - Math.random());
    // Cap at reasonable max
    return Math.min(Math.floor(multiplier * 100) / 100, 1000.00);
}

// Growth function: M(t) = 1.00 * e^(k * t)
const GROWTH_RATE = 0.15;

function getMultiplier(seconds) {
    return Math.floor(Math.exp(GROWTH_RATE * seconds) * 100) / 100;
}

function getTimeForMultiplier(multiplier) {
    if (multiplier <= 1) return 0;
    return Math.log(multiplier) / GROWTH_RATE;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('Jeu du Crash (Bourse)')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Le montant à parier')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const wager = interaction.options.getInteger('mise');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 1. Validation
        if (wager > MAX_BET) {
             return interaction.reply({ embeds: [errorEmbed(`Mise max: **${MAX_BET}**`)], ephemeral: true });
        }
        if (activeGames.has(userId)) {
             return interaction.reply({ embeds: [errorEmbed("Jeu en cours.")], ephemeral: true });
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

        // 3. Setup Game
        activeGames.set(userId, 'crash');
        const crashPoint = getCrashPoint();

        // Duration until crash (seconds)
        const crashTimeSeconds = getTimeForMultiplier(crashPoint);
        const startTime = Date.now();
        const crashTimestamp = startTime + (crashTimeSeconds * 1000);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('crash_cashout')
                    .setLabel('S\'éjecter (Cash Out)')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💸')
            );

        const embed = createEmbed()
            .setTitle('🚀 Crash')
            .setDescription(`Multiplicateur: **1.00x**\nGain potentiel: **${wager}**`)
            .setColor(COLORS.PRIMARY);

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Collector
        // Use time buffer to ensure we catch the 'crashed' state in the loop or interval
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: (crashTimeSeconds * 1000) + 5000,
            filter: i => i.user.id === userId
        });

        // Loop for Visuals
        const interval = setInterval(async () => {
            if (activeGames.get(userId) !== 'crash') {
                clearInterval(interval);
                return;
            }

            const elapsed = (Date.now() - startTime) / 1000;
            if (Date.now() >= crashTimestamp) {
                // Crashed (handled by timeout or explicit check)
                clearInterval(interval);
                if (!collector.ended) collector.stop('crashed');
                return;
            }

            const currentMult = getMultiplier(elapsed);
            const potentialWin = Math.floor(wager * currentMult);

            embed.setDescription(`🚀 **Décollage...**\nMultiplicateur: **${currentMult.toFixed(2)}x**\nGain potentiel: **${potentialWin}** ${EMOJIS.CASINO.COIN}`);

            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (e) {
                clearInterval(interval);
            }

        }, 2000); // 2 seconds to respect rate limits

        collector.on('collect', async i => {
            // Cash Out
            clearInterval(interval);

            const clickTime = Date.now();

            // Validate timing (latency check)
            if (clickTime >= crashTimestamp) {
                 // Too late (race condition)
                 collector.stop('crashed');
                 return;
            }

            const elapsed = (clickTime - startTime) / 1000;
            const cashOutMult = getMultiplier(elapsed);
            const winnings = Math.floor(wager * cashOutMult);

            // Payout
             try {
                 db.transaction(() => {
                    db.run(`UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`, [winnings, userId, guildId]);
                    db.run(`INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`, [userId, guildId, winnings, 'CASINO_WIN']);
                 })();
            } catch (e) {
                console.error("Crash Payout Error", e);
            }

            updateCasinoStats(userId, guildId, 'crash', wager, winnings);
            activeGames.delete(userId);

            const winEmbed = createEmbed()
                .setTitle('🚀 Crash - Ejecté !')
                .setColor(COLORS.SUCCESS)
                .setDescription(`✅ Vous vous êtes éjecté à **${cashOutMult.toFixed(2)}x** !\n\n💰 Gain : **${winnings}** ${EMOJIS.CASINO.COIN}\n(Le crash a eu lieu à ${crashPoint.toFixed(2)}x)`);

            await i.update({ embeds: [winEmbed], components: [] });
            collector.stop('cashout');
        });

        collector.on('end', async (collected, reason) => {
            clearInterval(interval);
            activeGames.delete(userId);

            if (reason === 'crashed' || (reason === 'time' && collected.size === 0)) {
                // Loss
                updateCasinoStats(userId, guildId, 'crash', wager, 0);

                const lossEmbed = createEmbed()
                    .setTitle('💥 CRASH !')
                    .setColor(COLORS.ERROR)
                    .setDescription(`🚀 Le vaisseau a explosé à **${crashPoint.toFixed(2)}x**.\n\n❌ Vous avez perdu **${wager}** ${EMOJIS.CASINO.COIN}.`);

                try {
                    await interaction.editReply({ embeds: [lossEmbed], components: [] });
                } catch (e) {
                    await interaction.followUp({ embeds: [lossEmbed], components: [] });
                }
            }
        });
    }
};
