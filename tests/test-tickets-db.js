/**
 * Script de test pour la base de données des tickets
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');
const config = require('../src/config');
const logger = require('../src/utils/logger');

async function runTests() {
  logger.info('🧪 Démarrage des tests de base de données tickets...');

  try {
    // 1. Initialisation
    logger.info('Test 1: Initialisation...');

    // Nous utilisons la BDD définie dans la config.
    const dbPath = config.paths.database;

    // Suppression préalable pour test propre
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

    // 2. Vérification des tables
    logger.info('Test 2: Vérification des tables...');

    // SQLite n'a pas de "SHOW TABLES" simple mais on peut interroger sqlite_master
    const tables = db.all("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map(t => t.name);

    if (tableNames.includes('tickets') && tableNames.includes('ticket_categories') && tableNames.includes('ticket_config')) {
        logger.success('✅ Tables tickets créées');
    } else {
        throw new Error(`Tables manquantes. Trouvées: ${tableNames.join(', ')}`);
    }

    // 3. Vérification des index
    logger.info('Test 3: Vérification des index...');
    const indexes = db.all("SELECT name FROM sqlite_master WHERE type='index'");
    const indexNames = indexes.map(i => i.name);

    if (indexNames.includes('idx_tickets_guild') && indexNames.includes('idx_tickets_user') && indexNames.includes('idx_tickets_status')) {
        logger.success('✅ Index tickets créés');
    } else {
        throw new Error(`Index manquants. Trouvés: ${indexNames.join(', ')}`);
    }

    // 4. Test Insertion ticket_config
    logger.info('Test 4: Insertion ticket_config...');
    const guildId = '123456789';
    db.run(
        'INSERT INTO ticket_config (guild_id, panel_channel_id, staff_role_id) VALUES (?, ?, ?)',
        [guildId, 'channel123', 'role123']
    );
    const configRow = db.get('SELECT * FROM ticket_config WHERE guild_id = ?', [guildId]);
    if (configRow && configRow.staff_role_id === 'role123') {
        logger.success('✅ Insertion ticket_config réussie');
    } else {
        throw new Error('Echec insertion ticket_config');
    }

    // 5. Test Insertion ticket_categories
    logger.info('Test 5: Insertion ticket_categories...');
    db.run(
        'INSERT INTO ticket_categories (guild_id, category_id, label, type) VALUES (?, ?, ?, ?)',
        [guildId, 'cat123', 'Aide', 'help']
    );
    const categoryRow = db.get('SELECT * FROM ticket_categories WHERE guild_id = ? AND type = ?', [guildId, 'help']);
    if (categoryRow && categoryRow.label === 'Aide') {
        logger.success('✅ Insertion ticket_categories réussie');
    } else {
        throw new Error('Echec insertion ticket_categories');
    }

    // 6. Test Insertion tickets
    logger.info('Test 6: Insertion tickets...');
    const userId = 'user999';
    db.run(
        'INSERT INTO tickets (guild_id, user_id, channel_id, category, status) VALUES (?, ?, ?, ?, ?)',
        [guildId, userId, 'chan_ticket_1', 'help', 'open']
    );
    const ticketRow = db.get('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    if (ticketRow && ticketRow.status === 'open' && ticketRow.category === 'help') {
        logger.success('✅ Insertion tickets réussie');
    } else {
        throw new Error('Echec insertion tickets');
    }

    // 7. Test Select avec index (implicite via performance mais on vérifie juste que ça marche)
    logger.info('Test 7: Requête sur tickets...');
    const tickets = db.all('SELECT * FROM tickets WHERE status = ?', ['open']);
    if (tickets.length === 1) {
        logger.success('✅ Requête tickets réussie');
    } else {
        throw new Error(`Attendu 1 ticket, trouvé ${tickets.length}`);
    }

    logger.success('🎉 ✅ Tous les tests de BDD tickets réussis');

  } catch (error) {
    logger.error(`❌ Échec des tests : ${error.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
