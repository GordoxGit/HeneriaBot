/**
 * Chargeur de questions de Quiz
 * Remplit la base de données avec les questions par défaut si la table est vide.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Initialise le contenu du quiz
 * @param {Object} db - Instance de la base de données (wrapper src/database/db.js)
 */
function init(db) {
  try {
    // Vérifier si la table est vide
    const count = db.get('SELECT COUNT(*) as count FROM quiz_questions');

    if (count.count > 0) {
      logger.info('Quiz: Base de questions déjà peuplée.');
      return;
    }

    logger.info('Quiz: Base vide, chargement des questions par défaut...');

    // Lire le fichier JSON
    const dataPath = path.join(__dirname, '../data/quizQuestions.json');
    if (!fs.existsSync(dataPath)) {
      logger.error(`Quiz: Fichier de données introuvable à ${dataPath}`);
      return;
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const questions = JSON.parse(rawData);

    // Insérer les questions via une transaction
    const insertStmt = db.transaction((questions) => {
      for (const q of questions) {
        db.run(
          `INSERT INTO quiz_questions (question, answers, correct_index, difficulty, category)
           VALUES (?, ?, ?, ?, ?)`,
          [
            q.question,
            JSON.stringify(q.answers),
            q.correct_index,
            q.difficulty,
            q.category
          ]
        );
      }
    });

    insertStmt(questions);
    logger.success(`Quiz: ${questions.length} questions importées avec succès.`);

  } catch (error) {
    logger.error(`Erreur lors du chargement du quiz : ${error.message}`);
  }
}

module.exports = { init };
