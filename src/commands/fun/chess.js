const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, MessageFlags } = require('discord.js');
const { Chess } = require('chess.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { getBoardImageUrl } = require('../../utils/chessRenderer');
const { createEmbed, errorEmbed, infoEmbed } = require('../../utils/embedBuilder');
const { getBestMove } = require('../../utils/chessAI');

// Map to store active games
// Key: userId (for both players), Value: Game Object
const activeChessGames = new Map();

const PIECE_NAMES = {
    p: 'Pion',
    n: 'Cavalier',
    b: 'Fou',
    r: 'Tour',
    q: 'Dame',
    k: 'Roi'
};

const PIECE_EMOJIS = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Jouer aux échecs')
        .addSubcommand(sub =>
            sub.setName('challenge')
                .setDescription('Défier un joueur ou le bot')
                .addUserOption(option => option.setName('adversaire').setDescription('L\'adversaire (laisser vide pour jouer contre le Bot)').setRequired(false))
                .addStringOption(option =>
                    option.setName('difficulte')
                        .setDescription('Difficulté du Bot')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Facile (Aléatoire)', value: 'Facile' },
                            { name: 'Moyen (Profondeur 2)', value: 'Moyen' },
                            { name: 'Difficile (Profondeur 3)', value: 'Difficile' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('resign')
                .setDescription('Abandonner la partie en cours')
        )
        .addSubcommand(sub =>
            sub.setName('draw')
                .setDescription('Proposer une nulle (Match nul)')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'challenge') {
            const opponentUser = interaction.options.getUser('adversaire');
            const difficulty = interaction.options.getString('difficulte') || 'Moyen';

            if (activeChessGames.has(userId)) {
                return interaction.editReply({
                    embeds: [errorEmbed('Vous êtes déjà dans une partie.')],
                    components: []
                });
            }

            if (opponentUser) {
                // PvP Mode
                if (opponentUser.id === userId) {
                    return interaction.editReply({
                        embeds: [errorEmbed('Vous ne pouvez pas jouer contre vous-même.')],
                        components: []
                    });
                }
                if (opponentUser.bot) {
                    return interaction.editReply({
                        embeds: [errorEmbed('Pour jouer contre le bot, n\'indiquez pas d\'adversaire.')],
                        components: []
                    });
                }
                if (activeChessGames.has(opponentUser.id)) {
                    return interaction.editReply({
                        embeds: [errorEmbed('Votre adversaire est déjà dans une partie.')],
                        components: []
                    });
                }

                const accepted = await initiateChallenge(interaction, opponentUser, 'Échecs');
                if (accepted) {
                    await startGame(interaction, interaction.user, opponentUser, false, null);
                }
            } else {
                // PvE Mode
                const botOpponent = {
                    id: 'bot',
                    username: `Bot Heneria (${difficulty})`,
                    discriminator: '0000',
                    bot: true,
                    toString: () => `**Bot Heneria (${difficulty})**`
                };

                await startGame(interaction, interaction.user, botOpponent, true, difficulty);
            }
        }
        else if (subcommand === 'resign') {
            const gameData = activeChessGames.get(userId);
            if (!gameData) {
                return interaction.editReply({
                    embeds: [errorEmbed('Vous n\'avez pas de partie en cours.')],
                    components: []
                });
            }

            // End game with loss
            const isWhite = gameData.white.id === userId;
            const winner = isWhite ? gameData.black : gameData.white;

            await endGame(gameData, `${interaction.user} a abandonné. ${winner} gagne !`, winner);

            interaction.editReply({ content: 'Vous avez abandonné la partie.', components: [] });
        }
        else if (subcommand === 'draw') {
             const gameData = activeChessGames.get(userId);
            if (!gameData) {
                return interaction.editReply({
                    embeds: [errorEmbed('Vous n\'avez pas de partie en cours.')],
                    components: []
                });
            }

             return interaction.editReply({
                embeds: [infoEmbed('Utilisez le bouton "Proposer Nulle" sur le message de la partie.')],
                components: []
            });
        }
    }
};

async function startGame(interaction, whitePlayer, blackPlayer, isBot = false, difficulty = null) {
    const game = new Chess();
    const gameId = `${whitePlayer.id}-${blackPlayer.id}-${Date.now()}`;

    const gameData = {
        id: gameId,
        game: game,
        white: whitePlayer,
        black: blackPlayer,
        message: null,
        collector: null,
        drawOffered: null,
        isBot: isBot,
        difficulty: difficulty
    };

    activeChessGames.set(whitePlayer.id, gameData);
    if (!isBot) {
        activeChessGames.set(blackPlayer.id, gameData);
    }

    const embed = getGameEmbed(gameData);
    const row = getGameComponents(gameData);

    const message = await interaction.editReply({
        content: `La partie commence ! ${whitePlayer} (Blancs) vs ${blackPlayer} (Noirs)`,
        embeds: [embed],
        components: [row]
    });

    gameData.message = message;

    // Create Collector
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 3600000 // 1 hour timeout
    });

    gameData.collector = collector;

    collector.on('collect', async i => {
        if (!activeChessGames.has(i.user.id)) {
            return i.reply({ content: 'Cette partie est terminée ou vous n\'y participez pas.', flags: MessageFlags.Ephemeral });
        }

        const userGame = activeChessGames.get(i.user.id);
        if (userGame.id !== gameId) {
             return i.reply({ content: 'Ce n\'est pas votre partie.', flags: MessageFlags.Ephemeral });
        }

        const isPlayer = i.user.id === whitePlayer.id || (isBot ? false : i.user.id === blackPlayer.id);
        if (!isPlayer) {
            return i.reply({ content: 'Vous n\'êtes pas dans cette partie.', flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'chess_move') {
            const turnColor = game.turn(); // 'w' or 'b'
            const isWhiteTurn = turnColor === 'w';
            const playerTurnId = isWhiteTurn ? whitePlayer.id : blackPlayer.id;

            if (i.user.id !== playerTurnId) {
                return i.reply({ content: 'Ce n\'est pas votre tour !', flags: MessageFlags.Ephemeral });
            }

            // --- New Interactive Flow ---

            // Step 1: Generate Piece Selection Menu
            const pieceMenuRow = getPieceMenu(game, turnColor);

            if (!pieceMenuRow) {
                return i.reply({ content: 'Aucun coup légal disponible (Mat ou Pat ?)', flags: MessageFlags.Ephemeral });
            }

            // Send Ephemeral Reply
            const ephemeralMsg = await i.reply({
                content: 'Sélectionnez une pièce à déplacer :',
                components: [pieceMenuRow],
                flags: MessageFlags.Ephemeral,
                fetchReply: true
            });

            // Create Nested Collector for the Ephemeral Interaction
            const nestedCollector = ephemeralMsg.createMessageComponentCollector({
                time: 60000 // 1 minute to make a move
            });

            nestedCollector.on('collect', async nestedI => {
                // Verify game is still active
                if (!activeChessGames.has(i.user.id) || activeChessGames.get(i.user.id).id !== gameId) {
                    return nestedI.reply({ content: 'La partie est terminée.', flags: MessageFlags.Ephemeral });
                }

                try {
                    if (nestedI.customId === 'chess_sel_piece') {
                        // Step 2: Show Destination Menu
                        const fromSquare = nestedI.values[0].replace('piece_', '');
                        const destMenuRow = getDestinationMenu(game, fromSquare);
                        const backButtonRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('chess_back_piece')
                                .setLabel('Retour (Changer de pièce)')
                                .setStyle(ButtonStyle.Secondary)
                        );

                        await nestedI.update({
                            content: `Vous avez sélectionné : **${fromSquare}**. Où voulez-vous aller ?`,
                            components: [destMenuRow, backButtonRow]
                        });
                    }
                    else if (nestedI.customId === 'chess_sel_dest') {
                        // Execution: Move Piece
                        const [from, to] = nestedI.values[0].replace('move_', '').split('_');

                        try {
                            const move = game.move({ from, to, promotion: 'q' }); // Auto-Queen
                            if (!move) throw new Error('Coup invalide');

                            // Success
                            gameData.drawOffered = null;

                            // Update Ephemeral to Success
                            await nestedI.update({
                                content: `Coup joué : **${move.san}** !`,
                                components: []
                            });
                            nestedCollector.stop(); // Stop ephemeral collector

                            // Update Public Board
                            if (game.isGameOver()) {
                                await handleGameOver(gameData.message, gameData, isWhiteTurn, whitePlayer, blackPlayer);
                            } else {
                                await gameData.message.edit({
                                    content: `Coup joué : **${move.san}**. Au tour de ${isWhiteTurn ? blackPlayer : whitePlayer}.`,
                                    embeds: [getGameEmbed(gameData)],
                                    components: [getGameComponents(gameData)]
                                });

                                // Trigger Bot if needed
                                if (isBot && !game.isGameOver()) {
                                    if (game.turn() === 'b') {
                                        playBotTurn(gameData);
                                    }
                                }
                            }

                        } catch (e) {
                            await nestedI.reply({ content: `Erreur : ${e.message}`, flags: MessageFlags.Ephemeral });
                        }
                    }
                    else if (nestedI.customId === 'chess_back_piece') {
                        // Go Back to Step 1
                        const backPieceMenuRow = getPieceMenu(game, turnColor);
                        await nestedI.update({
                            content: 'Sélectionnez une pièce à déplacer :',
                            components: [backPieceMenuRow]
                        });
                    }
                } catch (err) {
                    console.error("Chess Ephemeral Error:", err);
                }
            });

        } else if (i.customId === 'chess_resign') {
             const isWhite = i.user.id === whitePlayer.id;
             const winner = isWhite ? blackPlayer : whitePlayer;

             await i.update({
                 content: `${i.user} a abandonné. ${winner} gagne !`,
                 embeds: [getGameEmbed(gameData, "Abandon")],
                 components: []
             });

             cleanupGame(whitePlayer.id, blackPlayer.id);
             collector.stop();

        } else if (i.customId === 'chess_draw') {
             if (isBot) {
                  return i.reply({ content: 'Le bot refuse toujours la nulle (il est sans pitié).', flags: MessageFlags.Ephemeral });
             }

             if (gameData.drawOffered && gameData.drawOffered !== i.user.id) {
                 await i.update({
                     content: `Partie nulle par accord mutuel !`,
                     embeds: [getGameEmbed(gameData, "Nulle par accord")],
                     components: []
                 });
                 cleanupGame(whitePlayer.id, blackPlayer.id);
                 collector.stop();
             } else {
                 gameData.drawOffered = i.user.id;
                 await i.reply({ content: `${i.user} propose une nulle. L'adversaire doit cliquer sur "Proposer Nulle" pour accepter.`, flags: MessageFlags.Ephemeral });
             }
        }
    });

    collector.on('end', () => {
        cleanupGame(whitePlayer.id, blackPlayer.id);
    });
}

function getPieceMenu(game, color) {
    const moves = game.moves({ verbose: true });
    // Filter moves for current turn (should be handled by game.moves(), but 'color' is for emoji)

    // Group by 'from' square
    const piecesMap = new Map();
    moves.forEach(m => {
        if (!piecesMap.has(m.from)) {
            piecesMap.set(m.from, {
                piece: m.piece,
                color: m.color,
                san: m.san, // not used here directly but useful
                square: m.from
            });
        }
    });

    if (piecesMap.size === 0) return null;

    const options = [];
    for (const [square, data] of piecesMap) {
        const pieceName = PIECE_NAMES[data.piece] || 'Pièce';
        const emoji = PIECE_EMOJIS[data.color][data.piece] || '♟️';

        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${emoji} ${pieceName} en ${square.toUpperCase()}`)
                .setValue(`piece_${square}`)
        );
    }

    // Sort options alphabetically by square for consistency
    options.sort((a, b) => a.data.label.localeCompare(b.data.label));

    // Split into chunks if > 25 (max options for SelectMenu)
    // Assuming standard chess, max legal pieces to move is 16. Usually fine.
    // If somehow > 25, we might need multiple menus, but standard chess max pieces is 16.

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('chess_sel_piece')
        .setPlaceholder('Choisissez une pièce')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

function getDestinationMenu(game, fromSquare) {
    const moves = game.moves({ verbose: true });
    const pieceMoves = moves.filter(m => m.from === fromSquare);

    if (pieceMoves.length === 0) return null;

    const options = [];
    for (const m of pieceMoves) {
        let label = `Aller en ${m.to.toUpperCase()}`;
        if (m.captured) {
            label += ` (Capture)`; // Maybe add captured piece info if possible?
        }
        if (m.promotion) {
            label += ` (Promotion Dame)`;
        }
        if (m.san.includes('#')) {
            label += ` (Mat)`;
        } else if (m.san.includes('+')) {
            label += ` (Échec)`;
        }

        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(`move_${m.from}_${m.to}`)
        );
    }

    // Limit to 25 options (Standard chess max moves for a piece is rarely > 25. Queen max is 27. Should handle pagination if > 25?)
    // A Queen in center can have 27 moves.
    // If > 25, slice it for now. UX tradeoff.
    if (options.length > 25) {
        options.length = 25;
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('chess_sel_dest')
        .setPlaceholder(`Destinations pour ${fromSquare.toUpperCase()}`)
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

async function playBotTurn(gameData) {
    try {
        await new Promise(r => setTimeout(r, 1000));

        const moveStr = getBestMove(gameData.game, gameData.difficulty);

        if (moveStr) {
            gameData.game.move(moveStr);

            if (gameData.game.isGameOver()) {
                 let resultText = '';
                 let winner = null;

                 const botPlayer = gameData.black;
                 const humanPlayer = gameData.white;

                 if (gameData.game.isCheckmate()) {
                     winner = botPlayer;
                     resultText = `Échec et mat ! ${winner} a gagné !`;
                 } else if (gameData.game.isDraw()) {
                     resultText = 'Partie nulle !';
                     if (gameData.game.isStalemate()) resultText += ' (Pat)';
                     else resultText += ' (Égalité)';
                 }

                 await gameData.message.edit({
                     content: resultText,
                     embeds: [getGameEmbed(gameData, resultText)],
                     components: []
                 });

                 if (gameData.collector) gameData.collector.stop();
                 cleanupGame(humanPlayer.id, botPlayer.id);
            } else {
                await gameData.message.edit({
                    content: `Le Bot a joué **${moveStr}**. A vous !`,
                    embeds: [getGameEmbed(gameData)],
                    components: [getGameComponents(gameData)]
                });
            }
        }
    } catch (e) {
        console.error("Bot Error:", e);
    }
}

async function handleGameOver(message, gameData, isWhiteTurn, whitePlayer, blackPlayer) {
    let resultText = '';
    let winner = null;

    if (gameData.game.isCheckmate()) {
        winner = isWhiteTurn ? whitePlayer : blackPlayer;
        resultText = `Échec et mat ! ${winner} a gagné !`;
    } else if (gameData.game.isDraw()) {
        resultText = 'Partie nulle !';
        if (gameData.game.isStalemate()) resultText += ' (Pat)';
        else if (gameData.game.isThreefoldRepetition()) resultText += ' (Répétition)';
        else if (gameData.game.isInsufficientMaterial()) resultText += ' (Matériel insuffisant)';
        else if (gameData.game.isFiftyMoves()) resultText += ' (50 coups)';
    }

    try {
        // message is gameData.message (passed as arg 'interaction' in original code but really message object for update)
        // Wait, `handleGameOver` was called with `submitted` (interaction) in original code.
        // Here I'm calling it with `gameData.message` in one place?
        // Let's check call site: `await handleGameOver(gameData.message, ...)`
        // `gameData.message` is a Message object. It has .edit(), not .update().
        // If I pass interaction (like `nestedI`), I can use .update().
        // But the main board update usually happens via `.edit()` on the stored message unless we are replying to an interaction.
        // In `dest_select`, I already updated `nestedI` (ephemeral) to success.
        // Now I need to update the public board.
        // So `handleGameOver` should use `gameData.message.edit()`.

        await gameData.message.edit({
            content: resultText,
            embeds: [getGameEmbed(gameData, resultText)],
            components: []
        });
    } catch(e) {
        console.error("Game Over Error:", e);
    }

    if (gameData.collector) gameData.collector.stop();
    cleanupGame(whitePlayer.id, blackPlayer.id);
}

function getGameEmbed(gameData, resultText = null) {
    const fen = gameData.game.fen();
    const turn = gameData.game.turn() === 'w' ? "Blancs" : "Noirs";
    const player = gameData.game.turn() === 'w' ? gameData.white : gameData.black;
    const check = gameData.game.inCheck() ? "⚠️ Échec !" : "";

    const embed = createEmbed()
        .setTitle('Partie d\'Échecs')
        .setDescription(resultText || `Trait aux **${turn}** (${player})\n${check}`)
        .setImage(getBoardImageUrl(fen))
        .setFooter({ text: `Blancs: ${gameData.white.username} | Noirs: ${gameData.black.username}` });

    if (resultText) {
        embed.setColor(resultText.includes('gagné') ? '#00FF00' : '#808080');
    }

    return embed;
}

function getGameComponents(gameData) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('chess_move')
            .setLabel('Jouer un coup')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('chess_draw')
            .setLabel('Proposer Nulle')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('chess_resign')
            .setLabel('Abandonner')
            .setStyle(ButtonStyle.Danger)
    );
}

function cleanupGame(id1, id2) {
    if (id1) activeChessGames.delete(id1);
    if (id2 && id2 !== 'bot') activeChessGames.delete(id2);
}

async function endGame(gameData, message, winner) {
    if (gameData.message) {
        try {
            await gameData.message.edit({
                content: message,
                embeds: [getGameEmbed(gameData, message)],
                components: []
            });
        } catch(e) { /* ignore */ }
    }
    if (gameData.collector) gameData.collector.stop();
    cleanupGame(gameData.white.id, gameData.black.id);
}
