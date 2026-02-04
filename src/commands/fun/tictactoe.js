const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { createEmbed } = require('../../utils/embedBuilder');

const SYMBOLS = {
    EMPTY: ' ', // Zero width space or regular space
    X: '❌',
    O: '⭕'
};

const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Jouer au Morpion contre un autre joueur')
        .addUserOption(option =>
            option.setName('adversaire')
                .setDescription('Le joueur à défier')
                .setRequired(true)
        ),

    async execute(interaction) {
        const opponent = interaction.options.getUser('adversaire');
        const challenger = interaction.user;

        // Phase 1: Challenge
        const accepted = await initiateChallenge(interaction, opponent, 'Morpion');
        if (!accepted) return;

        // Phase 2: Game Setup
        // Board: 0-8. Value: 0 (Empty), 1 (Challenger), 2 (Opponent)
        const board = Array(9).fill(0);
        let turn = challenger.id; // Challenger starts

        const getComponents = (disabled = false) => {
            const rows = [];
            for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    const index = i * 3 + j;
                    const val = board[index];
                    const btn = new ButtonBuilder()
                        .setCustomId(`ttt_${index}`)
                        .setStyle(val === 0 ? ButtonStyle.Secondary : (val === 1 ? ButtonStyle.Primary : ButtonStyle.Danger))
                        .setLabel(val === 0 ? SYMBOLS.EMPTY : (val === 1 ? SYMBOLS.X : SYMBOLS.O))
                        .setDisabled(disabled || val !== 0);
                    row.addComponents(btn);
                }
                rows.push(row);
            }
            return rows;
        };

        const embed = createEmbed()
            .setTitle('Morpion (Tic-Tac-Toe)')
            .setDescription(`**${challenger}** (${SYMBOLS.X}) vs **${opponent}** (${SYMBOLS.O})\n\nC'est au tour de <@${turn}> !`);

        const gameMessage = await interaction.editReply({
            content: null,
            embeds: [embed],
            components: getComponents()
        });

        // Phase 3: Game Loop
        const collector = gameMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => [challenger.id, opponent.id].includes(i.user.id),
            time: 120000 // 2 minutes timeout
        });

        collector.on('collect', async i => {
            if (i.user.id !== turn) {
                await i.reply({ content: "Ce n'est pas votre tour !", flags: MessageFlags.Ephemeral });
                return;
            }

            const index = parseInt(i.customId.split('_')[1]);

            // Should not happen due to button disabled state, but good for safety
            if (board[index] !== 0) {
                 await i.reply({ content: "Case déjà occupée !", flags: MessageFlags.Ephemeral });
                 return;
            }

            // Update Board
            const playerValue = i.user.id === challenger.id ? 1 : 2;
            board[index] = playerValue;

            // Check Win
            let winner = null;
            for (const combo of WINNING_COMBINATIONS) {
                const [a, b, c] = combo;
                if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) {
                    winner = board[a] === 1 ? challenger : opponent;
                    break;
                }
            }

            // Check Draw
            const isDraw = !winner && board.every(cell => cell !== 0);

            if (winner || isDraw) {
                collector.stop('finished');

                const finalEmbed = createEmbed()
                    .setTitle('Morpion - Fin de partie')
                    .setDescription(`**${challenger}** (${SYMBOLS.X}) vs **${opponent}** (${SYMBOLS.O})\n\n` +
                        (winner ? `🏆 **${winner} a gagné !**` : "🤝 **Match Nul !**"))
                    .setColor(winner ? '#57F287' : '#FEE75C');

                await i.update({
                    embeds: [finalEmbed],
                    components: getComponents(true) // Disable all buttons
                });
            } else {
                // Switch Turn
                turn = turn === challenger.id ? opponent.id : challenger.id;

                const nextEmbed = createEmbed()
                    .setTitle('Morpion (Tic-Tac-Toe)')
                    .setDescription(`**${challenger}** (${SYMBOLS.X}) vs **${opponent}** (${SYMBOLS.O})\n\nC'est au tour de <@${turn}> !`);

                await i.update({
                    embeds: [nextEmbed],
                    components: getComponents()
                });
            }
        });

        collector.on('end', async (collected, reason) => {
             if (reason !== 'finished') {
                await interaction.editReply({
                    content: '⏱️ Temps écoulé ! La partie est annulée.',
                    components: getComponents(true)
                });
             }
        });
    }
};
