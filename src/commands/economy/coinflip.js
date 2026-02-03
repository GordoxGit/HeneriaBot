const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const EMOJIS = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Pariez sur Pile ou Face (Double ou Rien)')
        .addIntegerOption(option =>
            option.setName('mise')
                .setDescription('Le montant à parier')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('choix')
                .setDescription('Pile ou Face ?')
                .setRequired(true)
                .addChoices(
                    { name: 'Pile', value: 'pile' },
                    { name: 'Face', value: 'face' }
                )
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger('mise');
        const choice = interaction.options.getString('choix');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 1. Validations de base
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

                // Débit
                db.run(
                    `UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?`,
                    [amount, userId, guildId]
                );

                // Log Transaction (BET)
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
        const spinEmbed = createEmbed()
            .setTitle(`${EMOJIS.CASINO.COIN} Coinflip`)
            .setDescription(`La pièce tourne...`)
            .setColor(COLORS.PRIMARY);

        await interaction.reply({ embeds: [spinEmbed] });

        // Simulation délai
        setTimeout(async () => {
            // 4. RNG
            const isHeads = Math.random() < 0.5; // 50%
            const result = isHeads ? 'face' : 'pile'; // Assuming convention: Face=Heads, Pile=Tails (or similar mapping)
            // Let's stick to standard FR: Face (Heads), Pile (Tails)
            // choice values are 'face' and 'pile'

            const won = (choice === result);
            const payout = amount * 2;

            if (won) {
                try {
                    db.transaction(() => {
                        // Crédit Gains
                        db.run(
                            `UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`,
                            [payout, userId, guildId]
                        );

                        // Log Transaction (WIN)
                        db.run(
                            `INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`,
                            [userId, guildId, payout, 'CASINO_WIN']
                        );
                    })();
                } catch (error) {
                    console.error("Erreur payout coinflip:", error);
                    // On ne peut pas facilement rembourser ici sans risque, mais c'est un cas critique.
                    // On log l'erreur. L'utilisateur a perdu sa mise mais a gagné... c'est problématique.
                    // Dans un système pro, on aurait un système de job queue. Ici on fait au mieux.
                    return interaction.followUp({ content: `${EMOJIS.ERROR} Erreur critique lors du paiement des gains. Contactez un admin.` });
                }
            }

            // 5. Résultat
            const resultEmbed = createEmbed()
                .setTitle(`${EMOJIS.CASINO.COIN} Coinflip : Résultat`)
                .setColor(won ? COLORS.SUCCESS : COLORS.ERROR)
                .setDescription(won
                    ? `C'est **${result.toUpperCase()}** !\n\n${EMOJIS.SUCCESS} Vous gagnez **${payout}** ${EMOJIS.CASINO.COIN} !`
                    : `C'est **${result.toUpperCase()}**...\n\n${EMOJIS.ERROR} Vous perdez votre mise de **${amount}** ${EMOJIS.CASINO.COIN}.`
                )
                .addFields(
                    { name: 'Mise', value: `${amount}`, inline: true },
                    { name: 'Choix', value: choice.toUpperCase(), inline: true },
                    { name: 'Résultat', value: result.toUpperCase(), inline: true }
                );

            await interaction.editReply({ embeds: [resultEmbed] });

        }, 2000); // 2 secondes
    }
};
