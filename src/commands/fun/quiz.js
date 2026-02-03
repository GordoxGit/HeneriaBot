const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { infoEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const emojis = require('../../utils/emojis');

// Set pour gérer la concurrence (anti-spam)
const activeQuizzes = new Set();

const REWARDS = {
  'Facile': 50,
  'Moyen': 100,
  'Difficile': 200
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Répondez à une question sur Hytale et gagnez des récompenses !'),

  async execute(interaction) {
    const userId = interaction.user.id;

    if (activeQuizzes.has(userId)) {
      return interaction.reply({
        embeds: [errorEmbed('Vous avez déjà un quiz en cours ! Terminez-le d\'abord.')],
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // 1. Récupérer une question aléatoire
      const questionData = db.get('SELECT * FROM quiz_questions ORDER BY RANDOM() LIMIT 1');

      if (!questionData) {
        return interaction.reply({
          embeds: [errorEmbed('Aucune question disponible pour le moment.')],
          flags: MessageFlags.Ephemeral
        });
      }

      // Parser les réponses
      let answers;
      try {
        answers = JSON.parse(questionData.answers);
      } catch (e) {
        return interaction.reply({
          embeds: [errorEmbed('Erreur de données (format de réponse invalide).')],
          flags: MessageFlags.Ephemeral
        });
      }

      // Marquer le quiz comme actif
      activeQuizzes.add(userId);

      // 2. Préparer l'interface
      // Vérifier la longueur des réponses pour l'affichage
      const useLetterLabels = answers.some(a => a.length > 80);

      const embed = infoEmbed(`Quiz Hytale - Difficulté: ${questionData.difficulty}`)
        .setTitle(`❓ ${questionData.question}`)
        .setFooter({ text: `Gains potentiels: ${REWARDS[questionData.difficulty] || 100} 🪙` });

      let description = '';
      if (useLetterLabels) {
        description = `**A)** ${answers[0]}\n**B)** ${answers[1]}\n**C)** ${answers[2]}\n**D)** ${answers[3]}`;
        embed.setDescription(description);
      }

      // Créer les boutons
      const row = new ActionRowBuilder();
      const labels = ['A', 'B', 'C', 'D'];

      answers.forEach((ans, index) => {
        const btn = new ButtonBuilder()
          .setCustomId(`quiz_${index}`)
          .setStyle(ButtonStyle.Secondary);

        if (useLetterLabels) {
          btn.setLabel(labels[index]);
        } else {
          btn.setLabel(ans);
        }

        row.addComponents(btn);
      });

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
      });

      // 3. Collecteur d'interaction
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30000, // 30 secondes pour répondre
        max: 1
      });

      collector.on('collect', async i => {
        // Logique de jeu (Step 6) - Placeholder for now to fulfill Step 5 structure
        // Sera implémenté au prochain step, mais je dois gérer le clean-up du Set ici pour éviter les bugs si je m'arrête là.
        // Pour l'instant, je vais tout écrire car c'est plus logique.

        const selectedIndex = parseInt(i.customId.split('_')[1]);
        const isCorrect = selectedIndex === questionData.correct_index;
        const reward = REWARDS[questionData.difficulty] || 100;

        // Désactiver les boutons et colorer
        const newRow = new ActionRowBuilder();

        row.components.forEach((component, idx) => {
          const newBtn = ButtonBuilder.from(component);
          newBtn.setDisabled(true);

          if (idx === questionData.correct_index) {
            newBtn.setStyle(ButtonStyle.Success); // La bonne réponse toujours verte
          } else if (idx === selectedIndex && !isCorrect) {
            newBtn.setStyle(ButtonStyle.Danger); // Mauvaise réponse choisie rouge
          }

          newRow.addComponents(newBtn);
        });

        if (isCorrect) {
          // Transaction BDD
          try {
            db.transaction(() => {
              // 1. Donner l'argent
              db.run(
                `INSERT INTO wallets (user_id, guild_id, cash) VALUES (?, ?, ?)
                 ON CONFLICT(user_id, guild_id) DO UPDATE SET cash = cash + ?`,
                [userId, interaction.guildId, reward, reward]
              );

              // 2. Update stats
              db.run(
                `INSERT INTO quiz_scores (user_id, guild_id, correct_answers, total_earnings)
                 VALUES (?, ?, 1, ?)
                 ON CONFLICT(user_id, guild_id) DO UPDATE SET
                 correct_answers = correct_answers + 1,
                 total_earnings = total_earnings + ?`,
                [userId, interaction.guildId, reward, reward]
              );
            })();

            await i.update({
              content: `**Bonne réponse !** Vous gagnez **${reward}** ${emojis.CASINO.COIN} !`,
              components: [newRow],
              embeds: [embed.setColor('#00FF00')]
            });

          } catch (err) {
            console.error(err);
            await i.update({ content: 'Une erreur est survenue lors de la remise de récompense.', components: [] });
          }

        } else {
          await i.update({
            content: `**Mauvaise réponse...** La bonne réponse était **${answers[questionData.correct_index]}**.`,
            components: [newRow],
            embeds: [embed.setColor('#FF0000')]
          });
        }
      });

      collector.on('end', collected => {
        activeQuizzes.delete(userId);
        if (collected.size === 0) {
          // Temps écoulé
           const timeoutRow = new ActionRowBuilder();
           row.components.forEach(c => timeoutRow.addComponents(ButtonBuilder.from(c).setDisabled(true)));

           interaction.editReply({
             content: '⏱️ Temps écoulé !',
             components: [timeoutRow]
           }).catch(() => {});
        }
      });

    } catch (error) {
      activeQuizzes.delete(userId);
      console.error(error);
      return interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors du lancement du quiz.')],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
