const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, MessageFlags } = require('discord.js');
const { Chess } = require('chess.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { getBoardImageUrl } = require('../../utils/chessRenderer');
const { createEmbed, errorEmbed, infoEmbed, successEmbed } = require('../../utils/embedBuilder');

// Map to store active games
// Key: userId (for both players), Value: Game Object
const activeChessGames = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Jouer aux échecs')
        .addSubcommand(sub =>
            sub.setName('challenge')
                .setDescription('Défier un joueur')
                .addUserOption(option => option.setName('user').setDescription('L\'adversaire').setRequired(true))
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
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'challenge') {
            const opponent = interaction.options.getUser('user');

            if (activeChessGames.has(userId) || activeChessGames.has(opponent.id)) {
                return interaction.reply({
                    embeds: [errorEmbed('Vous ou votre adversaire êtes déjà dans une partie.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const accepted = await initiateChallenge(interaction, opponent, 'Échecs');

            if (accepted) {
                await startGame(interaction, interaction.user, opponent);
            }
        }
        else if (subcommand === 'resign') {
            const gameData = activeChessGames.get(userId);
            if (!gameData) {
                return interaction.reply({
                    embeds: [errorEmbed('Vous n\'avez pas de partie en cours.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            // End game with loss
            const isWhite = gameData.white.id === userId;
            const winner = isWhite ? gameData.black : gameData.white;

            await endGame(gameData, `${interaction.user} a abandonné. ${winner} gagne !`, winner);

            interaction.reply({ content: 'Vous avez abandonné la partie.', flags: MessageFlags.Ephemeral });
        }
        else if (subcommand === 'draw') {
             const gameData = activeChessGames.get(userId);
            if (!gameData) {
                return interaction.reply({
                    embeds: [errorEmbed('Vous n\'avez pas de partie en cours.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Propose draw logic could be complex (requires acceptance).
            // For simplicity and per plan, we might just handle it or skip complex negotiation.
            // Let's implement a simple "Draw offered" message or handle it inside the game loop buttons.
            // The plan said "Boutons pour Abandon/Nulle", so the subcommand is secondary.
            // I'll just say "Utilisez les boutons de la partie pour proposer une nulle."
             return interaction.reply({
                embeds: [infoEmbed('Utilisez le bouton "Proposer Nulle" sur le message de la partie.')],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

async function startGame(interaction, whitePlayer, blackPlayer) {
    const game = new Chess();
    const gameId = `${whitePlayer.id}-${blackPlayer.id}-${Date.now()}`;

    const gameData = {
        id: gameId,
        game: game,
        white: whitePlayer,
        black: blackPlayer,
        message: null,
        collector: null,
        drawOffered: null // userId of who offered draw
    };

    activeChessGames.set(whitePlayer.id, gameData);
    activeChessGames.set(blackPlayer.id, gameData);

    const embed = getGameEmbed(gameData);
    const row = getGameComponents(gameData);

    const message = await interaction.followUp({
        content: `La partie commence ! ${whitePlayer} (Blancs) vs ${blackPlayer} (Noirs)`,
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    gameData.message = message;

    // Create Collector
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 3600000 // 1 hour timeout
    });

    gameData.collector = collector;

    collector.on('collect', async i => {
        // Refresh game data ref in case needed, though object ref is const
        if (!activeChessGames.has(i.user.id)) {
            return i.reply({ content: 'Cette partie est terminée.', flags: MessageFlags.Ephemeral });
        }

        const isPlayer = i.user.id === whitePlayer.id || i.user.id === blackPlayer.id;
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
                    const move = game.move(moveStr); // Returns null if invalid, or throws? chess.js v1 throws on some, returns null on others?
                    // v1.0.0 returns null/undefined if invalid? Actually checking docs v1.4.0: .move(san) returns move object or null if invalid?
                    // Or throws error. "If the move is invalid, .move() will throw an error" (some versions).
                    // Let's try/catch.

                    if (!move) throw new Error('Coup invalide');

                    // Move successful
                    // Reset draw offer
                    gameData.drawOffered = null;

                    // Check Game Over
                    if (game.isGameOver()) {
                        let resultText = '';
                        let winner = null;

                        if (game.isCheckmate()) {
                            winner = isWhiteTurn ? whitePlayer : blackPlayer;
                            resultText = `Échec et mat ! ${winner} a gagné !`;
                        } else if (game.isDraw()) {
                            resultText = 'Partie nulle !';
                            if (game.isStalemate()) resultText += ' (Pat)';
                            else if (game.isThreefoldRepetition()) resultText += ' (Répétition)';
                            else if (game.isInsufficientMaterial()) resultText += ' (Matériel insuffisant)';
                            else if (game.isFiftyMoves()) resultText += ' (50 coups)';
                        }

                        await submitted.update({
                            content: resultText,
                            embeds: [getGameEmbed(gameData, resultText)],
                            components: []
                        });

                        cleanupGame(whitePlayer.id, blackPlayer.id);
                        collector.stop();
                    } else {
                        // Continue game
                        await submitted.update({
                            content: `Coup joué : **${move.san}**. Au tour de ${isWhiteTurn ? blackPlayer : whitePlayer}.`,
                            embeds: [getGameEmbed(gameData)],
                            components: [getGameComponents(gameData)]
                        });
                    }

                } catch (e) {
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
    activeChessGames.delete(id1);
    activeChessGames.delete(id2);
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
