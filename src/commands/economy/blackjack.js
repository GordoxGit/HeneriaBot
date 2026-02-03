const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createEmbed, errorEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const { activeGames, updateCasinoStats, Deck } = require('../../utils/casinoUtils');
const EMOJIS = require('../../utils/emojis');

function calculateHand(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else if (card.value === 'A') {
            aces += 1;
            value += 11;
        } else {
            value += parseInt(card.value);
        }
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }

    return value;
}

function formatHand(hand, hideFirst = false) {
    if (hideFirst) {
        return `?? ${hand.slice(1).map(c => `${c.value}${c.suit}`).join(' ')}`;
    }
    return hand.map(c => `${c.value}${c.suit}`).join(' ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Jouer au Blackjack contre le croupier')
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

        // 1. Validations
        if (wager > MAX_BET) {
            return interaction.reply({
                embeds: [errorEmbed(`La mise maximale est de **${MAX_BET}** ${EMOJIS.CASINO.COIN}.`)],
                ephemeral: true
            });
        }

        if (activeGames.has(userId)) {
            return interaction.reply({
                embeds: [errorEmbed("Vous avez déjà une partie en cours ! Terminez-la d'abord.")],
                ephemeral: true
            });
        }

        // 2. Transaction Débit
        let balanceError = null;
        try {
            db.transaction(() => {
                const wallet = db.get(
                    `SELECT cash FROM wallets WHERE user_id = ? AND guild_id = ?`,
                    [userId, guildId]
                );
                if (!wallet || wallet.cash < wager) {
                    balanceError = "Vous n'avez pas assez d'argent liquide.";
                    return;
                }
                db.run(
                    `UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?`,
                    [wager, userId, guildId]
                );
                db.run(
                    `INSERT INTO economy_transactions (from_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`,
                    [userId, guildId, wager, 'CASINO_BET']
                );
            })();
        } catch (error) {
            console.error("Blackjack Transaction Error:", error);
            return interaction.reply({ embeds: [errorEmbed("Erreur lors de la transaction.")], ephemeral: true });
        }

        if (balanceError) {
            return interaction.reply({ embeds: [errorEmbed(balanceError)], ephemeral: true });
        }

        // 3. Start Game
        activeGames.set(userId, 'blackjack');
        const deck = new Deck();
        const playerHand = [deck.draw(), deck.draw()];
        const dealerHand = [deck.draw(), deck.draw()];

        let playerValue = calculateHand(playerHand);
        let dealerValue = calculateHand(dealerHand);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('bj_hit')
                    .setLabel('Tirer (Hit)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('bj_stand')
                    .setLabel('Rester (Stand)')
                    .setStyle(ButtonStyle.Secondary)
            );

        const embed = createEmbed()
            .setTitle('🃏 Blackjack')
            .addFields(
                { name: `Votre Main [${playerValue}]`, value: formatHand(playerHand), inline: true },
                { name: `Croupier [?]`, value: formatHand(dealerHand, true), inline: true }
            )
            .setDescription(`Mise : **${wager}** ${EMOJIS.CASINO.COIN}`);

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Collector
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === userId,
            time: 60000
        });

        // Auto-stop if instant BJ
        if (playerValue === 21) {
            collector.stop('blackjack_instant');
        }

        collector.on('collect', async i => {
            if (i.customId === 'bj_hit') {
                playerHand.push(deck.draw());
                playerValue = calculateHand(playerHand);

                if (playerValue > 21) {
                    await i.update({
                         embeds: [
                            createEmbed()
                                .setTitle('🃏 Blackjack - Perdu')
                                .setColor(COLORS.ERROR)
                                .addFields(
                                    { name: `Votre Main [${playerValue}]`, value: formatHand(playerHand), inline: true },
                                    { name: `Croupier [?]`, value: formatHand(dealerHand, true), inline: true }
                                )
                                .setDescription(`🚫 **Bust !** Vous avez dépassé 21.\nVous perdez **${wager}** ${EMOJIS.CASINO.COIN}.`)
                         ],
                         components: []
                    });
                    collector.stop('bust');
                } else {
                     const newEmbed = createEmbed()
                        .setTitle('🃏 Blackjack')
                        .addFields(
                            { name: `Votre Main [${playerValue}]`, value: formatHand(playerHand), inline: true },
                            { name: `Croupier [?]`, value: formatHand(dealerHand, true), inline: true }
                        )
                        .setDescription(`Mise : **${wager}** ${EMOJIS.CASINO.COIN}`);

                     if (playerValue === 21) {
                         await i.update({ embeds: [newEmbed], components: [] });
                         collector.stop('stand');
                     } else {
                         await i.update({ embeds: [newEmbed] });
                     }
                }
            } else if (i.customId === 'bj_stand') {
                await i.deferUpdate();
                collector.stop('stand');
            }
        });

        collector.on('end', async (collected, reason) => {
            activeGames.delete(userId);

            if (reason === 'bust') {
                updateCasinoStats(userId, guildId, 'blackjack', wager, 0);
                return;
            }

            // Dealer Logic
            while (dealerValue < 17) {
                dealerHand.push(deck.draw());
                dealerValue = calculateHand(dealerHand);
            }

            let winnings = 0;
            let resultText = "";
            let color = COLORS.PRIMARY;

            if (dealerValue > 21) {
                winnings = wager * 2;
                resultText = `🎉 Le Croupier a sauté (${dealerValue}) ! Vous gagnez **${winnings}** !`;
                color = COLORS.SUCCESS;
            } else if (playerValue > dealerValue) {
                if (playerValue === 21 && playerHand.length === 2) {
                     winnings = Math.floor(wager * 2.5);
                     resultText = `🃏 **BLACKJACK !** Vous gagnez **${winnings}** !`;
                } else {
                     winnings = wager * 2;
                     resultText = `✅ Vous gagnez ! (${playerValue} vs ${dealerValue})`;
                }
                color = COLORS.SUCCESS;
            } else if (playerValue === dealerValue) {
                winnings = wager;
                resultText = `🤝 Égalité (Push). Votre mise est rendue.`;
                color = COLORS.WARNING;
            } else {
                winnings = 0;
                resultText = `❌ Le Croupier gagne (${dealerValue} vs ${playerValue}).`;
                color = COLORS.ERROR;
            }

            // Payout
            if (winnings > 0) {
                try {
                     db.transaction(() => {
                        db.run(`UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`, [winnings, userId, guildId]);
                        db.run(`INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`, [userId, guildId, winnings, 'CASINO_WIN']);
                     })();
                } catch (e) {
                    console.error("BJ Payout Error", e);
                }
            }

            updateCasinoStats(userId, guildId, 'blackjack', wager, winnings);

            const finalEmbed = createEmbed()
                .setTitle('🃏 Blackjack - Résultat')
                .setColor(color)
                 .addFields(
                    { name: `Votre Main [${playerValue}]`, value: formatHand(playerHand), inline: true },
                    { name: `Croupier [${dealerValue}]`, value: formatHand(dealerHand), inline: true }
                )
                .setDescription(resultText);

            // Only edit if the collector didn't stop because of a bust (which already edited)
            // But 'bust' triggers early return.
            // If stopped by 'blackjack_instant' or 'stand', we need to edit.

            try {
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
            } catch (e) {
                // If original message is deleted or something
            }
        });
    }
};
