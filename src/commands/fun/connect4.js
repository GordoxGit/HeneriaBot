const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { createEmbed } = require('../../utils/embedBuilder');

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const P1 = 1; // Challenger
const P2 = 2; // Opponent

const EMOJIS = {
    [EMPTY]: '⚫',
    [P1]: '🔴',
    [P2]: '🟡'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connect4')
        .setDescription('Jouer au Puissance 4 contre un autre joueur')
        .addUserOption(option =>
            option.setName('adversaire')
                .setDescription('Le joueur à défier')
                .setRequired(true)
        ),

    async execute(interaction) {
        const opponent = interaction.options.getUser('adversaire');
        const challenger = interaction.user;

        // Phase 1: Challenge
        const accepted = await initiateChallenge(interaction, opponent, 'Puissance 4');
        if (!accepted) return;

        // Phase 2: Game Setup
        // Grid is array of arrays [row][col]
        // Row 0 is top, Row 5 is bottom
        const grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
        let turn = challenger.id; // Challenger starts

        const renderBoard = () => {
            let boardStr = '';
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    boardStr += EMOJIS[grid[r][c]];
                }
                boardStr += '\n';
            }
            // Column numbers
            boardStr += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
            return boardStr;
        };

        const getComponents = (disabled = false) => {
            const row = new ActionRowBuilder();
            for (let c = 0; c < COLS; c++) {
                // Check if column is full
                const isFull = grid[0][c] !== EMPTY;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`c4_${c}`)
                        .setLabel(`${c + 1}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(disabled || isFull)
                );
            }
            return [row];
        };

        const embed = createEmbed()
            .setTitle('Puissance 4 (Connect 4)')
            .setDescription(`**${challenger}** (${EMOJIS[P1]}) vs **${opponent}** (${EMOJIS[P2]})\n\nC'est au tour de <@${turn}> !\n\n${renderBoard()}`);

        const gameMessage = await interaction.editReply({
            content: null,
            embeds: [embed],
            components: getComponents()
        });

        // Phase 3: Game Loop
        const collector = gameMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => [challenger.id, opponent.id].includes(i.user.id),
            time: 300000 // 5 minutes timeout
        });

        collector.on('collect', async i => {
            if (i.user.id !== turn) {
                await i.reply({ content: "Ce n'est pas votre tour !", flags: MessageFlags.Ephemeral });
                return;
            }

            const col = parseInt(i.customId.split('_')[1]);

            // Gravity Logic: Find lowest empty row
            let rowToPlace = -1;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (grid[r][col] === EMPTY) {
                    rowToPlace = r;
                    break;
                }
            }

            if (rowToPlace === -1) {
                // Column full - should be disabled but handled for safety
                await i.reply({ content: "Colonne pleine !", flags: MessageFlags.Ephemeral });
                return;
            }

            // Place Piece
            const playerVal = i.user.id === challenger.id ? P1 : P2;
            grid[rowToPlace][col] = playerVal;

            // Check Win
            const checkWin = (r, c, player) => {
                // Horizontal
                if (c + 3 < COLS &&
                    grid[r][c+1] === player &&
                    grid[r][c+2] === player &&
                    grid[r][c+3] === player) return true;

                // Vertical
                if (r + 3 < ROWS &&
                    grid[r+1][c] === player &&
                    grid[r+2][c] === player &&
                    grid[r+3][c] === player) return true;

                // Diagonal Down-Right
                if (r + 3 < ROWS && c + 3 < COLS &&
                    grid[r+1][c+1] === player &&
                    grid[r+2][c+2] === player &&
                    grid[r+3][c+3] === player) return true;

                // Diagonal Up-Right
                if (r - 3 >= 0 && c + 3 < COLS &&
                    grid[r-1][c+1] === player &&
                    grid[r-2][c+2] === player &&
                    grid[r-3][c+3] === player) return true;

                return false;
            };

            // Optimization: Only check from the placed piece or check entire board.
            // Checking entire board is safer/easier to implement quickly.
            let winner = null;

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const p = grid[r][c];
                    if (p !== EMPTY) {
                        if (checkWin(r, c, p)) {
                            winner = p === P1 ? challenger : opponent;
                        }
                    }
                }
            }

            const isDraw = !winner && grid.every(row => row.every(cell => cell !== EMPTY));

            if (winner || isDraw) {
                collector.stop('finished');
                 const finalEmbed = createEmbed()
                    .setTitle('Puissance 4 - Fin de partie')
                    .setDescription(`**${challenger}** (${EMOJIS[P1]}) vs **${opponent}** (${EMOJIS[P2]})\n\n` +
                        (winner ? `🏆 **${winner} a gagné !**` : "🤝 **Match Nul !**") +
                        `\n\n${renderBoard()}`)
                    .setColor(winner ? '#57F287' : '#FEE75C');

                await i.update({
                    embeds: [finalEmbed],
                    components: getComponents(true)
                });
            } else {
                turn = turn === challenger.id ? opponent.id : challenger.id;
                 const nextEmbed = createEmbed()
                    .setTitle('Puissance 4 (Connect 4)')
                    .setDescription(`**${challenger}** (${EMOJIS[P1]}) vs **${opponent}** (${EMOJIS[P2]})\n\nC'est au tour de <@${turn}> !\n\n${renderBoard()}`);

                await i.update({
                    embeds: [nextEmbed],
                    components: getComponents() // Updates disabled buttons if col full
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
