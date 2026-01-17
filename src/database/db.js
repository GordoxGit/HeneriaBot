/**
 * Gestionnaire de base de données SQLite
 * Implémente la connexion et les méthodes utilitaires pour better-sqlite3
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

let db;

/**
 * Initialise la connexion à la base de données et crée les tables
 */
function init() {
  try {
    // Assurer que le dossier data existe
    const dbPath = config.paths.database;
    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Dossier créé : ${dir}`);
    }

    // Connexion à la base de données
    const options = config.environment === 'development'
      ? { verbose: console.log }
      : {};

    db = new Database(dbPath, options);
    logger.success('Base de données connectée');

    // Création des tables
    createTables();

  } catch (error) {
    logger.error(`Erreur lors de l'initialisation de la base de données : ${error.message}`);
    throw error;
  }
}

/**
 * Crée les tables nécessaires si elles n'existent pas
 */
function createTables() {
  const schemas = [
    {
      name: 'guilds',
      sql: `CREATE TABLE IF NOT EXISTS guilds (
        guild_id TEXT PRIMARY KEY,
        name TEXT,
        prefix TEXT DEFAULT '/',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        discriminator TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'settings',
      sql: `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        key TEXT,
        value TEXT,
        UNIQUE(guild_id, key)
      )`
    }
  ];

  for (const schema of schemas) {
    try {
      db.prepare(schema.sql).run();
      logger.info(`Table '${schema.name}' vérifiée/créée`);
    } catch (error) {
      logger.error(`Erreur création table ${schema.name}: ${error.message}`);
    }
  }
}

/**
 * Exécute une requête qui ne retourne pas de résultats (INSERT, UPDATE, DELETE)
 * @param {string} sql - La requête SQL
 * @param {Array} params - Les paramètres de la requête
 * @returns {Object} Résultat de l'exécution (info.changes, info.lastInsertRowid)
 */
function run(sql, params = []) {
  try {
    if (!db) throw new Error('La base de données n\'est pas initialisée');
    return db.prepare(sql).run(params);
  } catch (error) {
    logger.error(`Erreur SQL (run) : ${error.message} | Query: ${sql}`);
    throw error;
  }
}

/**
 * Récupère une seule ligne de résultat
 * @param {string} sql - La requête SQL
 * @param {Array} params - Les paramètres de la requête
 * @returns {Object|undefined} La ligne trouvée ou undefined
 */
function get(sql, params = []) {
  try {
    if (!db) throw new Error('La base de données n\'est pas initialisée');
    return db.prepare(sql).get(params);
  } catch (error) {
    logger.error(`Erreur SQL (get) : ${error.message} | Query: ${sql}`);
    throw error;
  }
}

/**
 * Récupère toutes les lignes de résultat
 * @param {string} sql - La requête SQL
 * @param {Array} params - Les paramètres de la requête
 * @returns {Array} Tableau des lignes trouvées
 */
function all(sql, params = []) {
  try {
    if (!db) throw new Error('La base de données n\'est pas initialisée');
    return db.prepare(sql).all(params);
  } catch (error) {
    logger.error(`Erreur SQL (all) : ${error.message} | Query: ${sql}`);
    throw error;
  }
}

/**
 * Ferme la connexion à la base de données
 */
function close() {
  if (db) {
    db.close();
    logger.info('Connexion à la base de données fermée');
    db = null;
  }
}

module.exports = {
  init,
  run,
  get,
  all,
  close
};
