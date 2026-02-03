const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Duel de dés contre le Bot (Celui qui fait le plus gros score gagne)')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Le montant à parier')
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger('mise');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 1. Validations
        if (amount > MAX_BET) {
            return interaction.reply({
                content: `${EMOJIS.ERROR} La mise maximale est de **${MAX_BET}** ${EMOJIS.CASINO.COIN}.`,
                ephemeral: true
            });
        }

        // 2. Vérification Solde et Débit (Atomic)
        let balanceError = null;

        try {
            db.transaction(() => {
                const wallet = db.get(
                    `SELECT cash FROM wallets WHERE user_id = ? AND guild_id = ?`,
                    [userId, guildId]
                );

                if (!wallet || wallet.cash < amount) {
                    balanceError = "Vous n'avez pas assez d'argent liquide.";
                    return;
                }

                db.run(
                    `UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?`,
                    [amount, userId, guildId]
                );

                db.run(
                    `INSERT INTO economy_transactions (from_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`,
                    [userId, guildId, amount, 'CASINO_BET']
                );
            })();
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: `${EMOJIS.ERROR} Une erreur est survenue lors de la transaction.`,
                ephemeral: true
            });
        }

        if (balanceError) {
            return interaction.reply({
                content: `${EMOJIS.ERROR} ${balanceError}`,
                ephemeral: true
            });
        }

        // 3. Animation
        const rollEmbed = createEmbed()
            .setTitle(`${EMOJIS.CASINO.DICE} Duel de Dés`)
            .setDescription(`Les dés roulent sur la table...`)
            .setColor(COLORS.PRIMARY);

        await interaction.reply({ embeds: [rollEmbed] });

        // Simulation délai
        setTimeout(async () => {
            // 4. RNG
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;

            let resultMsg = "";
            let color = COLORS.PRIMARY;
            let payout = 0;

            if (userRoll > botRoll) {
                // Victoire
                payout = amount * 2;
                resultMsg = `🏆 **VICTOIRE !**\n\nVous avez fait un **${userRoll}** et le bot a fait un **${botRoll}**.\n${EMOJIS.SUCCESS} Vous remportez **${payout}** ${EMOJIS.CASINO.COIN} !`;
                color = COLORS.SUCCESS;
            } else if (userRoll === botRoll) {
                // Égalité
                payout = amount; // Remboursement
                resultMsg = `🤝 **ÉGALITÉ !**\n\nVous avez fait un **${userRoll}** et le bot aussi.\nVotre mise vous est remboursée.`;
                color = COLORS.WARNING;
            } else {
                // Défaite
                resultMsg = `💀 **DÉFAITE...**\n\nVous avez fait un **${userRoll}** mais le bot a fait un **${botRoll}**.\n${EMOJIS.ERROR} Vous perdez votre mise de **${amount}** ${EMOJIS.CASINO.COIN}.`;
                color = COLORS.ERROR;
            }

            // Paiement (si gain ou remboursement)
            if (payout > 0) {
                try {
                    db.transaction(() => {
                        db.run(
                            `UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`,
                            [payout, userId, guildId]
                        );
                        db.run(
                            `INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`,
                            [userId, guildId, payout, 'CASINO_WIN']
                        );
                    })();
                } catch (error) {
                    console.error("Erreur payout dice:", error);
                    return interaction.followUp({ content: `${EMOJIS.ERROR} Erreur critique lors du paiement des gains. Contactez un admin.` });
                }
            }

            // 5. Résultat
            const resultEmbed = createEmbed()
                .setTitle(`${EMOJIS.CASINO.DICE} Résultat du Duel`)
                .setColor(color)
                .setDescription(resultMsg)
                .addFields(
                    { name: 'Votre Lancer', value: `${userRoll} ${EMOJIS.CASINO.DICE}`, inline: true },
                    { name: 'Lancer Bot', value: `${botRoll} ${EMOJIS.CASINO.DICE}`, inline: true },
                    { name: 'Mise', value: `${amount}`, inline: true }
                );

            await interaction.editReply({ embeds: [resultEmbed] });

        }, 2000);
    }
};
