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

    // Migration des tables si nécessaire
    migrateTables();

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
    },
    {
      name: 'welcome_config',
      sql: `CREATE TABLE IF NOT EXISTS welcome_config (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        message TEXT,
        enabled INTEGER DEFAULT 1
      )`
    },
    {
      name: 'counter_config',
      sql: `CREATE TABLE IF NOT EXISTS counter_config (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        format TEXT DEFAULT '👥 Membres : {count}',
        last_update INTEGER DEFAULT 0
      )`
    },
    {
      name: 'tickets',
      sql: `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        staff_id TEXT,
        channel_id TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        close_reason TEXT
      )`
    },
    {
      name: 'ticket_categories',
      sql: `CREATE TABLE IF NOT EXISTS ticket_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        emoji TEXT,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1
      )`
    },
    {
      name: 'ticket_config',
      sql: `CREATE TABLE IF NOT EXISTS ticket_config (
        guild_id TEXT PRIMARY KEY,
        panel_channel_id TEXT,
        panel_message_id TEXT,
        staff_channel_id TEXT,
        log_channel_id TEXT,
        staff_role_id TEXT
      )`
    },
    {
      name: 'vote_sites',
      sql: `CREATE TABLE IF NOT EXISTS vote_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        url TEXT NOT NULL,
        api_type TEXT NOT NULL,
        api_base_url TEXT,
        api_token TEXT,
        webhook_channel_id TEXT,
        cooldown_hours INTEGER DEFAULT 24,
        reward_xp INTEGER DEFAULT 50,
        reward_money INTEGER DEFAULT 100,
        enabled INTEGER DEFAULT 1,
        position INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(guild_id, slug)
      )`
    },
    {
      name: 'user_votes',
      sql: `CREATE TABLE IF NOT EXISTS user_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        site_slug TEXT NOT NULL,
        voted_at INTEGER NOT NULL,
        external_vote_id TEXT,
        verification_method TEXT,
        otp_token TEXT,
        claimed INTEGER DEFAULT 0,
        rewards_given INTEGER DEFAULT 0,
        UNIQUE(external_vote_id),
        FOREIGN KEY (guild_id, site_slug) REFERENCES vote_sites(guild_id, slug) ON DELETE CASCADE
      )`
    },
    {
      name: 'vote_otp_sessions',
      sql: `CREATE TABLE IF NOT EXISTS vote_otp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        site_slug TEXT NOT NULL,
        otp_token TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        UNIQUE(otp_token)
      )`
    },
    {
      name: 'vote_stats',
      sql: `CREATE TABLE IF NOT EXISTS vote_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        total_votes INTEGER DEFAULT 0,
        monthly_votes INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        last_vote_at INTEGER,
        last_month_reset INTEGER,
        UNIQUE(user_id, guild_id)
      )`
    },
    {
      name: 'vote_rewards_config',
      sql: `CREATE TABLE IF NOT EXISTS vote_rewards_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        base_value INTEGER NOT NULL,
        streak_bonus_percent INTEGER DEFAULT 0,
        max_streak_bonus INTEGER DEFAULT 100,
        enabled INTEGER DEFAULT 1,
        UNIQUE(guild_id, reward_type)
      )`
    },
    {
      name: 'user_levels',
      sql: `CREATE TABLE IF NOT EXISTS user_levels (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        last_message_timestamp INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
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

  // Création des index pour l'optimisation
  const indexes = [
    {
      name: 'idx_tickets_guild',
      sql: `CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id)`
    },
    {
      name: 'idx_tickets_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id)`
    },
    {
      name: 'idx_tickets_status',
      sql: `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`
    },
    {
      name: 'idx_user_votes_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_votes_user ON user_votes(user_id, guild_id)`
    },
    {
      name: 'idx_user_votes_site',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_votes_site ON user_votes(site_slug, guild_id)`
    },
    {
      name: 'idx_user_votes_time',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_votes_time ON user_votes(voted_at)`
    },
    {
      name: 'idx_otp_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_otp_user ON vote_otp_sessions(user_id, guild_id)`
    },
    {
      name: 'idx_otp_expires',
      sql: `CREATE INDEX IF NOT EXISTS idx_otp_expires ON vote_otp_sessions(expires_at)`
    },
    {
      name: 'idx_user_levels_guild',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_levels_guild ON user_levels(guild_id)`
    },
    {
      name: 'idx_user_levels_xp',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(guild_id, xp DESC)`
    }
  ];

  for (const index of indexes) {
    try {
      db.prepare(index.sql).run();
      logger.info(`Index '${index.name}' vérifié/créé`);
    } catch (error) {
      logger.error(`Erreur création index ${index.name}: ${error.message}`);
    }
  }
}

/**
 * Migre les tables existantes vers le nouveau schéma si nécessaire
 */
function migrateTables() {
  // Pas de migrations pour le moment
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
