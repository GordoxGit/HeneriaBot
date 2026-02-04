const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { initiateChallenge } = require('../../utils/gameUtils');
const { createEmbed } = require('../../utils/embedBuilder');

const MOVES = {
    ROCK: { id: 'rock', label: 'Pierre', emoji: '🪨', beats: 'scissors' },
    PAPER: { id: 'paper', label: 'Papier', emoji: '📄', beats: 'rock' },
    SCISSORS: { id: 'scissors', label: 'Ciseaux', emoji: '✂️', beats: 'paper' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Jouer à Pierre-Papier-Ciseaux contre un autre joueur')
        .addUserOption(option =>
            option.setName('adversaire')
                .setDescription('Le joueur à défier')
                .setRequired(true)
        ),

    async execute(interaction) {
        const opponent = interaction.options.getUser('adversaire');
        const challenger = interaction.user;

        // Phase 1: Challenge
        const accepted = await initiateChallenge(interaction, opponent, 'Pierre-Papier-Ciseaux');
        if (!accepted) return;

        // Phase 2: Game Setup
        const choices = new Map(); // userId -> moveId

        const embed = createEmbed()
            .setTitle('Pierre - Papier - Ciseaux')
            .setDescription(`**${challenger}** vs **${opponent}**\n\nFaites votre choix en secret !`)
            .addFields(
                { name: challenger.username, value: '⏳ En attente...', inline: true },
                { name: opponent.username, value: '⏳ En attente...', inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rock').setLabel('Pierre').setEmoji('🪨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('paper').setLabel('Papier').setEmoji('📄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('scissors').setLabel('Ciseaux').setEmoji('✂️').setStyle(ButtonStyle.Secondary)
        );

        const gameMessage = await interaction.editReply({
            content: null,
            embeds: [embed],
            components: [row]
        });

        // Phase 3: Game Logic
        const collector = gameMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => [challenger.id, opponent.id].includes(i.user.id),
            time: 60000 // 60 seconds to choose
        });

        collector.on('collect', async i => {
            if (choices.has(i.user.id)) {
                await i.reply({ content: 'Vous avez déjà choisi !', flags: MessageFlags.Ephemeral });
                return;
            }

            choices.set(i.user.id, i.customId);

            await i.reply({ content: `Vous avez choisi **${MOVES[i.customId.toUpperCase()].label}** !`, flags: MessageFlags.Ephemeral });

            // Update Embed Status
            const challengerStatus = choices.has(challenger.id) ? '✅ Choisi' : '⏳ En attente...';
            const opponentStatus = choices.has(opponent.id) ? '✅ Choisi' : '⏳ En attente...';

            const updatedEmbed = createEmbed()
                .setTitle('Pierre - Papier - Ciseaux')
                .setDescription(`**${challenger}** vs **${opponent}**\n\nFaites votre choix en secret !`)
                .addFields(
                    { name: challenger.username, value: challengerStatus, inline: true },
                    { name: opponent.username, value: opponentStatus, inline: true }
                );

            await gameMessage.edit({ embeds: [updatedEmbed] });

            if (choices.size === 2) {
                collector.stop('finished');
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'finished') {
                const cMoveId = choices.get(challenger.id);
                const oMoveId = choices.get(opponent.id);
                const cMove = Object.values(MOVES).find(m => m.id === cMoveId);
                const oMove = Object.values(MOVES).find(m => m.id === oMoveId);

                let resultText = '';
                let color = '#2b2d31'; // Default

                if (cMoveId === oMoveId) {
                    resultText = "🤝 **Match Nul !**";
                    color = '#FEE75C';
                } else if (cMove.beats === oMoveId) {
                    resultText = `🏆 **${challenger} remporte la victoire !**`;
                    color = '#57F287';
                } else {
                    resultText = `🏆 **${opponent} remporte la victoire !**`;
                    color = '#57F287';
                }

                const finalEmbed = createEmbed()
                    .setTitle('Résultat : Pierre - Papier - Ciseaux')
                    .setDescription(`**${challenger}** vs **${opponent}**\n\n${resultText}`)
                    .addFields(
                        { name: challenger.username, value: `${cMove.emoji} ${cMove.label}`, inline: true },
                        { name: opponent.username, value: `${oMove.emoji} ${oMove.label}`, inline: true }
                    )
                    .setColor(color);

                await interaction.editReply({ embeds: [finalEmbed], components: [] });
            } else {
                // Timeout
                await interaction.editReply({
                    content: '⏱️ Temps écoulé ! La partie est annulée.',
                    embeds: [],
                    components: []
                });
            }
        });
    }
};
