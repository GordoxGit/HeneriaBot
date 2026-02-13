const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, MessageFlags } = require('discord.js');
const { Chess } = require('chess.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { getBoardImageUrl } = require('../../utils/chessRenderer');
const { createEmbed, errorEmbed, infoEmbed, successEmbed } = require('../../utils/embedBuilder');
const { getBestMove } = require('../../utils/chessAI');

// Map to store active games
// Key: userId (for both players), Value: Game Object
const activeChessGames = new Map();

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
            // Check if it is the active game's player but game finished?
            // Usually if not in map, game over or error.
            return i.reply({ content: 'Cette partie est terminée ou vous n\'y participez pas.', flags: MessageFlags.Ephemeral });
        }

        // Safety check to ensure they are interacting with THEIR game
        const userGame = activeChessGames.get(i.user.id);
        if (userGame.id !== gameId) {
             return i.reply({ content: 'Ce n\'est pas votre partie.', flags: MessageFlags.Ephemeral });
        }

        const isPlayer = i.user.id === whitePlayer.id || (isBot ? false : i.user.id === blackPlayer.id);
        if (!isPlayer) {
            return i.reply({ content: 'Vous n\'êtes pas dans cette partie.', flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'chess_move') {
            // Check turn
            const turnColor = game.turn(); // 'w' or 'b'
            const isWhiteTurn = turnColor === 'w';
            const playerTurnId = isWhiteTurn ? whitePlayer.id : blackPlayer.id;

            if (i.user.id !== playerTurnId) {
                return i.reply({ content: 'Ce n\'est pas votre tour !', flags: MessageFlags.Ephemeral });
            }

            // Show Modal
            const modal = new ModalBuilder()
                .setCustomId(`chess_modal_${gameId}`)
                .setTitle('Jouer un coup');

            const moveInput = new TextInputBuilder()
                .setCustomId('move_input')
                .setLabel("Notation (ex: e4, Nf3, O-O)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(6);

            const firstActionRow = new ActionRowBuilder().addComponents(moveInput);
            modal.addComponents(firstActionRow);

            await i.showModal(modal);

            // Await submission
            try {
                const submitted = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (submission) => submission.customId === `chess_modal_${gameId}`
                });

                const moveStr = submitted.fields.getTextInputValue('move_input');

                try {
                    const move = game.move(moveStr);
                    if (!move) throw new Error('Coup invalide');

                    // Move successful
                    gameData.drawOffered = null;

                    // Update Board immediately
                    if (game.isGameOver()) {
                        await handleGameOver(submitted, gameData, isWhiteTurn, whitePlayer, blackPlayer);
                    } else {
                        // Continue game
                        await submitted.update({
                            content: `Coup joué : **${move.san}**. Au tour de ${isWhiteTurn ? blackPlayer : whitePlayer}.`,
                            embeds: [getGameEmbed(gameData)],
                            components: [getGameComponents(gameData)]
                        });

                        // Trigger Bot if needed
                        if (isBot && !game.isGameOver()) {
                            // Check if it's bot's turn (Bot is Black usually, so if turn is 'b')
                            if (game.turn() === 'b') {
                                playBotTurn(gameData);
                            }
                        }
                    }

                } catch (e) {
                    // console.error(e);
                    await submitted.reply({ content: `Coup invalide : ${moveStr}. Vérifiez la notation.`, flags: MessageFlags.Ephemeral });
                }

            } catch (err) {
                 // Modal timed out or error
            }

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

             // If already offered by opponent, accept it
             if (gameData.drawOffered && gameData.drawOffered !== i.user.id) {
                 // Accept draw
                 await i.update({
                     content: `Partie nulle par accord mutuel !`,
                     embeds: [getGameEmbed(gameData, "Nulle par accord")],
                     components: []
                 });
                 cleanupGame(whitePlayer.id, blackPlayer.id);
                 collector.stop();
             } else {
                 // Offer draw
                 gameData.drawOffered = i.user.id;
                 await i.reply({ content: `${i.user} propose une nulle. L'adversaire doit cliquer sur "Proposer Nulle" pour accepter.`, flags: MessageFlags.Ephemeral });
             }
        }
    });

    collector.on('end', () => {
        cleanupGame(whitePlayer.id, blackPlayer.id);
    });
}

async function playBotTurn(gameData) {
    // Artificial delay
    // Edit message to say "Bot reflecting..."
    try {
        /* Optional: Show bot is thinking
        await gameData.message.edit({
             embeds: [getGameEmbed(gameData).setFooter({ text: 'Le Bot réfléchit...' })]
        });
        */

        // Delay 1s
        await new Promise(r => setTimeout(r, 1000));

        const moveStr = getBestMove(gameData.game, gameData.difficulty);

        if (moveStr) {
            gameData.game.move(moveStr);

            const isWhiteTurn = gameData.game.turn() === 'w'; // Bot just played, so now it's White's turn?
            // Wait, getBestMove returns move. We played it.
            // If Bot was Black, now turn is White.

            if (gameData.game.isGameOver()) {
                // Determine winner
                 let resultText = '';
                 let winner = null;

                 const botPlayer = gameData.black; // Bot
                 const humanPlayer = gameData.white;

                 if (gameData.game.isCheckmate()) {
                     // Who moved? Bot. So Bot wins.
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

async function handleGameOver(interaction, gameData, isWhiteTurn, whitePlayer, blackPlayer) {
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

    await interaction.update({
        content: resultText,
        embeds: [getGameEmbed(gameData, resultText)],
        components: []
    });

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

// Helper to manually end game from subcommand
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
