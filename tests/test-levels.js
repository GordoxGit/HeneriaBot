/**
 * Script de test pour le système de niveaux
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const levelSystem = require('../src/utils/levelSystem');

// Override DB Path BEFORE requiring db
const TEST_DB_PATH = './data/test_levels.db';
config.paths.database = TEST_DB_PATH;

const db = require('../src/database/db');

async function runTests() {
  logger.info('🧪 Démarrage des tests du système de niveaux...');

  try {
    // 0. Setup
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // 1. Test Math Utility
    logger.info('Test 1: Mathématiques XP...');

    // Level 0 -> 1 requires 100 XP (Total XP needed to complete Lvl 0)
    // Formula: 5*0^2 + 50*0 + 100 = 100
    const t0 = levelSystem.getLevelThreshold(0);
    if (t0 !== 100) throw new Error(`Threshold 0 incorrect: ${t0}`);

    // Level 1 -> 2 requires 5(1)^2 + 50(1) + 100 = 155
    const t1 = levelSystem.getLevelThreshold(1);
    if (t1 !== 155) throw new Error(`Threshold 1 incorrect: ${t1}`);

    // Total XP for Level 2 (reaching it from 0) = 100 (lvl0) + 155 (lvl1) = 255
    const total2 = levelSystem.getTotalXpForLevel(2);
    if (total2 !== 255) throw new Error(`Total Level 2 incorrect: ${total2}`);

    // Progress Calculation
    // 50 XP -> Level 0, 50% progress (100 needed)
    const p1 = levelSystem.calculateLevelProgress(50);
    if (p1.level !== 0 || p1.progressPercent !== 50) throw new Error(`Progress 50xp incorrect: ${JSON.stringify(p1)}`);

    // 100 XP -> Level 1, 0% progress (155 needed for next)
    const p2 = levelSystem.calculateLevelProgress(100);
    if (p2.level !== 1 || p2.progressPercent !== 0) throw new Error(`Progress 100xp incorrect: ${JSON.stringify(p2)}`);

    // 177 XP -> Level 1 (100 base). 177 - 100 = 77 current. Needed 155.
    // 77 / 155 * 100 = 49.67 -> 49%
    const p3 = levelSystem.calculateLevelProgress(177);
    if (p3.level !== 1 || p3.currentLevelXp !== 77 || p3.progressPercent !== 49) throw new Error(`Progress 177xp incorrect: ${JSON.stringify(p3)}`);

    logger.success('✅ Mathématiques validées');


    // 2. Test Database Integration
    logger.info('Test 2: Base de données...');

    db.init(); // Creates tables including user_levels

    const userId = 'user_test_1';
    const guildId = 'guild_test_1';

    // Insert
    db.run(
      'INSERT INTO user_levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)',
      [userId, guildId, 100, 1]
    );

    const user = db.get('SELECT * FROM user_levels WHERE user_id = ?', [userId]);
    if (!user || user.level !== 1) throw new Error('Insertion échouée');

    // Rank Calculation
    // Insert another user with more XP
    db.run(
      'INSERT INTO user_levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)',
      ['user_test_2', guildId, 500, 3]
    );

    // Insert user with less XP
    db.run(
      'INSERT INTO user_levels (user_id, guild_id, xp, level) VALUES (?, ?, ?, ?)',
      ['user_test_3', guildId, 50, 0]
    );

    // user_test_1 has 100 XP. user_test_2 has 500. user_test_3 has 50.
    // user_test_1 should be Rank 2.
    const rankQuery = db.get(
        'SELECT COUNT(*) as count FROM user_levels WHERE guild_id = ? AND xp > ?',
        [guildId, 100]
    );
    const rank = rankQuery.count + 1;

    if (rank !== 2) throw new Error(`Calcul de rang incorrect: ${rank} (attendu 2)`);

    logger.success('✅ DB Integration validée');

    logger.success('🎉 ✅ Tous les tests de niveaux réussis');

  } catch (error) {
    logger.error(`❌ Échec des tests : ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (e) {
        // ignore
      }
    }
  }
}

runTests();
