const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { infoEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const emojis = require('../../utils/emojis');
const questions = require('../../data/triviaQuestions.json');

// Set to prevent spamming multiple trivias at once per user
const activeTrivia = new Set();

const REWARDS = {
    'Facile': 50,
    'Moyen': 100,
    'Difficile': 200
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Répondez à une question de culture générale pour gagner de l\'argent !'),

    async execute(interaction) {
        const userId = interaction.user.id;

        if (activeTrivia.has(userId)) {
            return interaction.reply({
                embeds: [errorEmbed('Vous avez déjà un quiz en cours ! Terminez-le d\'abord.')],
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Pick a random question
            const questionData = questions[Math.floor(Math.random() * questions.length)];
            const answers = questionData.answers;

            // Mark as active
            activeTrivia.add(userId);

            const reward = REWARDS[questionData.difficulty] || 50;

            const embed = infoEmbed(`Trivia Culture G - Difficulté: ${questionData.difficulty}`)
                .setTitle(`❓ ${questionData.question}`)
                .setDescription(`**A)** ${answers[0]}\n**B)** ${answers[1]}\n**C)** ${answers[2]}\n**D)** ${answers[3]}`)
                .setFooter({ text: `Gains potentiels: ${reward} 🪙 | Catégorie: ${questionData.category}` });

            const row = new ActionRowBuilder();
            const labels = ['A', 'B', 'C', 'D'];

            labels.forEach((label, index) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`trivia_${index}`)
                        .setLabel(label)
                        .setStyle(ButtonStyle.Secondary)
                );
            });

            const reply = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id,
                time: 30000,
                max: 1
            });

            collector.on('collect', async i => {
                const selectedIndex = parseInt(i.customId.split('_')[1]);
                const isCorrect = selectedIndex === questionData.correct_index;

                // Disable buttons and show result
                const newRow = new ActionRowBuilder();
                row.components.forEach((component, idx) => {
                    const newBtn = ButtonBuilder.from(component);
                    newBtn.setDisabled(true);

                    if (idx === questionData.correct_index) {
                        newBtn.setStyle(ButtonStyle.Success);
                    } else if (idx === selectedIndex && !isCorrect) {
                        newBtn.setStyle(ButtonStyle.Danger);
                    }
                    newRow.addComponents(newBtn);
                });

                if (isCorrect) {
                     try {
                        db.transaction(() => {
                            db.run(
                                `INSERT INTO wallets (user_id, guild_id, cash) VALUES (?, ?, ?)
                                 ON CONFLICT(user_id, guild_id) DO UPDATE SET cash = cash + ?`,
                                [userId, interaction.guildId, reward, reward]
                            );

                            // Log transaction
                            db.run(
                                `INSERT INTO economy_transactions (user_id, guild_id, type, amount, reason, timestamp)
                                 VALUES (?, ?, 'TRIVIA_WIN', ?, ?, ?)`,
                                [userId, interaction.guildId, reward, `Win Trivia (${questionData.difficulty})`, Date.now()]
                            );
                        })();

                        await i.update({
                            content: `**Bonne réponse !** Vous gagnez **${reward}** ${emojis.CASINO.COIN || 'crédits'} !`,
                            embeds: [embed.setColor('#00FF00')],
                            components: [newRow]
                        });
                    } catch (e) {
                        console.error(e);
                        await i.update({ content: 'Erreur lors de la distribution de la récompense.', components: [] });
                    }
                } else {
                    await i.update({
                        content: `**Mauvaise réponse...** La bonne réponse était **${answers[questionData.correct_index]}**.`,
                        embeds: [embed.setColor('#FF0000')],
                        components: [newRow]
                    });
                }
            });

            collector.on('end', (collected) => {
                activeTrivia.delete(userId);
                if (collected.size === 0) {
                     const timeoutRow = new ActionRowBuilder();
                     row.components.forEach(c => timeoutRow.addComponents(ButtonBuilder.from(c).setDisabled(true)));

                     interaction.editReply({
                         content: '⏱️ Temps écoulé !',
                         components: [timeoutRow]
                     }).catch(() => {});
                }
            });

        } catch (error) {
            activeTrivia.delete(userId);
            console.error(error);
            interaction.reply({
                embeds: [errorEmbed('Une erreur est survenue.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};
