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

    // Initialisation des sites de vote par défaut
    initVoteSites();

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
        url TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        position INTEGER DEFAULT 0,
        reward_xp INTEGER DEFAULT 0,
        reward_money INTEGER DEFAULT 0
      )`
    },
    {
      name: 'user_votes',
      sql: `CREATE TABLE IF NOT EXISTS user_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        voted_at INTEGER NOT NULL,
        verified BOOLEAN DEFAULT 1,
        verification_method TEXT DEFAULT 'webhook',
        verified_by TEXT,
        external_vote_id TEXT,
        UNIQUE(user_id, guild_id, site_name, voted_at)
      )`
    },
    {
      name: 'vote_stats',
      sql: `CREATE TABLE IF NOT EXISTS vote_stats (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        total_votes INTEGER DEFAULT 0,
        last_vote INTEGER,
        PRIMARY KEY (user_id, guild_id)
      )`
    },
    {
      name: 'vote_rewards',
      sql: `CREATE TABLE IF NOT EXISTS vote_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT UNIQUE,
        currency_amount INTEGER DEFAULT 0,
        xp_amount INTEGER DEFAULT 0,
        role_id TEXT
      )`
    },
    {
      name: 'vote_username_links',
      sql: `CREATE TABLE IF NOT EXISTS vote_username_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        site_username TEXT NOT NULL,
        verification_code TEXT,
        verified BOOLEAN DEFAULT 0,
        created_at INTEGER NOT NULL,
        verified_at INTEGER,
        expires_at INTEGER,
        UNIQUE(user_id, guild_id, site_name),
        UNIQUE(guild_id, site_name, site_username)
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
      name: 'idx_user_votes_lookup',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_votes_lookup ON user_votes(user_id, guild_id, site_name, voted_at)`
    },
    {
      name: 'idx_external_vote_id',
      sql: `CREATE INDEX IF NOT EXISTS idx_external_vote_id ON user_votes(external_vote_id)`
    },
    {
      name: 'idx_vote_sites_guild',
      sql: `CREATE INDEX IF NOT EXISTS idx_vote_sites_guild ON vote_sites(guild_id)`
    },
    {
      name: 'idx_vote_links_username',
      sql: `CREATE INDEX IF NOT EXISTS idx_vote_links_username ON vote_username_links(guild_id, site_name, site_username)`
    },
    {
      name: 'idx_vote_links_code',
      sql: `CREATE INDEX IF NOT EXISTS idx_vote_links_code ON vote_username_links(verification_code)`
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
  try {
    // Migration vote_sites
    const voteSitesInfo = db.prepare('PRAGMA table_info(vote_sites)').all();
    const hasRewardXp = voteSitesInfo.some(col => col.name === 'reward_xp');

    if (!hasRewardXp) {
      db.prepare('ALTER TABLE vote_sites ADD COLUMN reward_xp INTEGER DEFAULT 0').run();
      db.prepare('ALTER TABLE vote_sites ADD COLUMN reward_money INTEGER DEFAULT 0').run();
      logger.info('Colonnes reward ajoutées à vote_sites');
    }

    // Migration user_votes
    const userVotesInfo = db.prepare('PRAGMA table_info(user_votes)').all();
    const hasSiteId = userVotesInfo.some(col => col.name === 'site_id');
    const hasExternalVoteId = userVotesInfo.some(col => col.name === 'external_vote_id');

    if (hasSiteId) {
      // Old schema detected
      logger.info('Migration de la table user_votes...');
      db.prepare('ALTER TABLE user_votes RENAME TO user_votes_old').run();

      // Recreate table with new schema
      db.prepare(`CREATE TABLE user_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        voted_at INTEGER NOT NULL,
        verified BOOLEAN DEFAULT 1,
        verification_method TEXT DEFAULT 'webhook',
        verified_by TEXT,
        external_vote_id TEXT,
        UNIQUE(user_id, guild_id, site_name, voted_at)
      )`).run();

      logger.info('Table user_votes migrée (ancienne sauvegardée en user_votes_old)');
    } else if (!hasExternalVoteId) {
      db.prepare('ALTER TABLE user_votes ADD COLUMN external_vote_id TEXT').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_external_vote_id ON user_votes(external_vote_id)').run();
      logger.info('Colonne external_vote_id ajoutée à user_votes');
    }
  } catch (error) {
    logger.error(`Erreur migration : ${error.message}`);
  }
}

/**
 * Initialise les sites de vote par défaut s'ils n'existent pas
 */
function initVoteSites() {
  const guildId = config.guildId;

  if (!guildId) {
    logger.warn('GUILD_ID non configuré, impossible d\'initialiser les sites de vote par défaut');
    return;
  }

  try {
    const existingSites = db.prepare('SELECT count(*) as count FROM vote_sites WHERE guild_id = ?').get(guildId);

    if (existingSites.count === 0) {
      const defaultSites = [
        { name: 'Hytale Game Serveurs', url: 'https://hytale.game/serveurs/?sid=heneria', position: 1 },
        { name: 'Hytale-Servs', url: 'https://hytale-servs.fr/servers/heneria', position: 2 },
        { name: 'Top-Serveurs Hytale', url: 'https://top-serveurs.net/hytale/heneria', position: 3 },
        { name: 'Serveur-Prive Hytale', url: 'https://serveur-prive.net/hytale/heneria', position: 4 }
      ];

      const insert = db.prepare('INSERT INTO vote_sites (guild_id, name, url, position) VALUES (?, ?, ?, ?)');

      const transaction = db.transaction((sites) => {
        for (const site of sites) {
          insert.run(guildId, site.name, site.url, site.position);
        }
      });

      transaction(defaultSites);
      logger.success('Sites de vote par défaut initialisés');
    }
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation des sites de vote : ${error.message}`);
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
