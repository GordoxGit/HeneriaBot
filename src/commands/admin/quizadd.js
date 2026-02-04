const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quizadd')
    .setDescription('Ajouter une nouvelle question au Quiz Hytale')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('question')
        .setDescription('La question à poser')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reponse_a')
        .setDescription('Réponse A')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reponse_b')
        .setDescription('Réponse B')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reponse_c')
        .setDescription('Réponse C')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reponse_d')
        .setDescription('Réponse D')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('bonne_reponse')
        .setDescription('Laquelle est la bonne réponse ?')
        .setRequired(true)
        .addChoices(
          { name: 'A', value: '0' },
          { name: 'B', value: '1' },
          { name: 'C', value: '2' },
          { name: 'D', value: '3' }
        ))
    .addStringOption(option =>
      option.setName('difficulte')
        .setDescription('Niveau de difficulté')
        .setRequired(true)
        .addChoices(
          { name: 'Facile', value: 'Facile' },
          { name: 'Moyen', value: 'Moyen' },
          { name: 'Difficile', value: 'Difficile' }
        ))
    .addStringOption(option =>
      option.setName('categorie')
        .setDescription('Catégorie de la question (Défaut: Lore)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const question = interaction.options.getString('question');
      const answers = [
        interaction.options.getString('reponse_a'),
        interaction.options.getString('reponse_b'),
        interaction.options.getString('reponse_c'),
        interaction.options.getString('reponse_d')
      ];
      const correctIndex = parseInt(interaction.options.getString('bonne_reponse'));
      const difficulty = interaction.options.getString('difficulte');
      const category = interaction.options.getString('categorie') || 'Lore';

      // Validation basique
      if (answers.some(a => a.length > 80)) {
        // Warning sur la longueur, mais on accepte (l'affichage gérera)
      }

      const stmt = db.run(
        `INSERT INTO quiz_questions (question, answers, correct_index, difficulty, category)
         VALUES (?, ?, ?, ?, ?)`,
        [
          question,
          JSON.stringify(answers),
          correctIndex,
          difficulty,
          category
        ]
      );

      const embed = successEmbed('Question ajoutée avec succès !')
        .addFields(
          { name: 'Question', value: question },
          { name: 'Réponses', value: `A) ${answers[0]}\nB) ${answers[1]}\nC) ${answers[2]}\nD) ${answers[3]}` },
          { name: 'Bonne réponse', value: ['A', 'B', 'C', 'D'][correctIndex], inline: true },
          { name: 'Difficulté', value: difficulty, inline: true },
          { name: 'Catégorie', value: category, inline: true },
          { name: 'ID', value: stmt.lastInsertRowid.toString(), inline: true }
        );

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      return interaction.reply({
        embeds: [errorEmbed(`Erreur lors de l'ajout de la question : ${error.message}`)],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
