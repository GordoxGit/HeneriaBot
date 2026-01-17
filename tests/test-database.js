/**
 * Script de test pour la base de données
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');
const config = require('../src/config');
const logger = require('../src/utils/logger');

async function runTests() {
  logger.info('🧪 Démarrage des tests de base de données...');

  try {
    // 1. Initialisation
    logger.info('Test 1: Initialisation...');

    // Nous utilisons la BDD définie dans la config.
    // Attention: ceci supprimera la base de données actuelle pour repartir de zéro.
    const dbPath = config.paths.database;

    if (fs.existsSync(dbPath)) {
      logger.info('Suppression de la BDD existante pour le test...');
      fs.unlinkSync(dbPath);
    }

    db.init();

    if (fs.existsSync(dbPath)) {
      logger.success('✅ Fichier BDD créé');
    } else {
      throw new Error('Fichier BDD non créé');
    }

    // 2. Insertions
    logger.info('Test 2: Insertions...');

    db.run('INSERT INTO guilds (guild_id, name) VALUES (?, ?)', ['123', 'Test Guild']);
    db.run('INSERT INTO users (user_id, username, discriminator) VALUES (?, ?, ?)', ['456', 'TestUser', '0000']);
    db.run('INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?)', ['123', 'welcome_channel', 'general']);

    logger.success('✅ Insertions réussies');

    // 3. Lecture
    logger.info('Test 3: Lecture (get)...');

    const guild = db.get('SELECT * FROM guilds WHERE guild_id = ?', ['123']);
    if (guild && guild.name === 'Test Guild') {
      logger.success('✅ Lecture guild réussie');
    } else {
      throw new Error('Lecture guild échouée');
    }

    const user = db.get('SELECT * FROM users WHERE user_id = ?', ['456']);
    if (user && user.username === 'TestUser') {
      logger.success('✅ Lecture user réussie');
    } else {
      throw new Error('Lecture user échouée');
    }

    // 4. Lecture multiple
    logger.info('Test 4: Lecture multiple (all)...');
    db.run('INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?)', ['123', 'lang', 'fr']);

    const settings = db.all('SELECT * FROM settings WHERE guild_id = ?', ['123']);
    if (settings.length === 2) {
      logger.success('✅ Lecture multiple settings réussie');
    } else {
      throw new Error(`Attendu 2 settings, reçu ${settings.length}`);
    }

    // 5. Nettoyage
    logger.info('Test 5: Nettoyage...');
    db.run('DELETE FROM guilds WHERE guild_id = ?', ['123']);
    db.run('DELETE FROM users WHERE user_id = ?', ['456']);
    db.run('DELETE FROM settings WHERE guild_id = ?', ['123']);

    const count = db.get('SELECT COUNT(*) as count FROM guilds');
    if (count.count === 0) {
      logger.success('✅ Nettoyage réussi');
    } else {
      logger.warn('⚠️ La BDD n\'est pas vide après nettoyage');
    }

    logger.success('🎉 ✅ Tous les tests de BDD réussis');

  } catch (error) {
    logger.error(`❌ Échec des tests : ${error.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
