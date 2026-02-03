const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const { MAX_BET } = require('../../config/economy');
const EMOJIS = require('../../utils/emojis');

const SYMBOLS = [
    { emoji: EMOJIS.CASINO.COMMON, weight: 40, payout: 3, name: "Commun" },
    { emoji: EMOJIS.CASINO.UNCOMMON, weight: 30, payout: 5, name: "Peu Commun" },
    { emoji: EMOJIS.CASINO.RARE, weight: 15, payout: 10, name: "Rare" },
    { emoji: EMOJIS.CASINO.EPIC, weight: 10, payout: 20, name: "Épique" },
    { emoji: EMOJIS.CASINO.LEGENDARY, weight: 5, payout: 50, name: "Légendaire" }
];

function getRandomSymbol() {
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
        if (random < symbol.weight) return symbol;
        random -= symbol.weight;
    }
    return SYMBOLS[0];
}

function generateGrid() {
    return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
}

function calculateWinnings(grid, bet) {
    const [s1, s2, s3] = grid;

    // 3 Identiques
    if (s1.emoji === s2.emoji && s2.emoji === s3.emoji) {
        return { payout: bet * s1.payout, multiplier: s1.payout, type: 'JACKPOT', symbol: s1 };
    }

    // 2 Identiques (Paire)
    if (s1.emoji === s2.emoji || s2.emoji === s3.emoji || s1.emoji === s3.emoji) {
        return { payout: bet * 1, multiplier: 1, type: 'PAIR', symbol: null };
    }

    return { payout: 0, multiplier: 0, type: 'LOSS', symbol: null };
}

function formatGrid(grid) {
    return `| ${grid[0].emoji} | ${grid[1].emoji} | ${grid[2].emoji} |`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Jouer à la machine à sous')
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

        // 2. Transaction Débit
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
            return interaction.reply({ content: `${EMOJIS.ERROR} Erreur transaction.`, ephemeral: true });
        }

        if (balanceError) {
             return interaction.reply({ content: `${EMOJIS.ERROR} ${balanceError}`, ephemeral: true });
        }

        // 3. Animation
        const embed = createEmbed()
            .setTitle(`${EMOJIS.CASINO.SLOT_MACHINE} Machine à Sous`)
            .setDescription(`${formatGrid(generateGrid())}\n\n*Les rouleaux tournent...*`)
            .setColor(COLORS.PRIMARY);

        await interaction.reply({ embeds: [embed] });

        // Animation frames
        const frames = 2;
        for (let i = 0; i < frames; i++) {
            await new Promise(r => setTimeout(r, 800));
            embed.setDescription(`${formatGrid(generateGrid())}\n\n*Les rouleaux tournent...*`);
            await interaction.editReply({ embeds: [embed] });
        }

        await new Promise(r => setTimeout(r, 800));

        // 4. Résultat Final
        const finalGrid = generateGrid();
        const result = calculateWinnings(finalGrid, amount);

        // Paiement
        if (result.payout > 0) {
            try {
                db.transaction(() => {
                    db.run(
                        `UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?`,
                        [result.payout, userId, guildId]
                    );
                    db.run(
                        `INSERT INTO economy_transactions (to_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)`,
                        [userId, guildId, result.payout, 'CASINO_WIN']
                    );
                })();
            } catch (error) {
                console.error("Erreur payout slots:", error);
                return interaction.followUp({ content: `${EMOJIS.ERROR} Erreur paiement gains.` });
            }
        }

        // Message de fin
        let flavorText = "";
        let color = COLORS.ERROR;

        if (result.type === 'JACKPOT') {
            flavorText = `🎰 **JACKPOT !**\n\n${EMOJIS.SUCCESS} 3 Symboles **${result.symbol.name}** !\nVous gagnez **x${result.multiplier}** votre mise !\n\n💰 Gain : **${result.payout}** ${EMOJIS.CASINO.COIN}`;
            color = COLORS.SUCCESS; // Or Gold if available
        } else if (result.type === 'PAIR') {
            flavorText = `👀 **Pas mal !**\n\n${EMOJIS.SUCCESS} Une paire ! Vous êtes remboursé.\n\n💰 Gain : **${result.payout}** ${EMOJIS.CASINO.COIN}`;
            color = COLORS.WARNING; // Warning is usually yellow/orange
        } else {
            flavorText = `❌ **Perdu...**\n\nVous perdez votre mise de **${amount}** ${EMOJIS.CASINO.COIN}.`;
            color = COLORS.ERROR;
        }

        embed.setDescription(`${formatGrid(finalGrid)}\n\n${flavorText}`)
             .setColor(color);

        await interaction.editReply({ embeds: [embed] });
    }
};
