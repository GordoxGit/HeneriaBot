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
    },
    {
      name: 'level_rewards',
      sql: `CREATE TABLE IF NOT EXISTS level_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        UNIQUE(guild_id, level)
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
      name: 'autorole_panels',
      sql: `CREATE TABLE IF NOT EXISTS autorole_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        title TEXT,
        type TEXT NOT NULL
      )`
    },
    {
      name: 'autorole_entries',
      sql: `CREATE TABLE IF NOT EXISTS autorole_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_id INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        emoji TEXT,
        label TEXT,
        FOREIGN KEY (panel_id) REFERENCES autorole_panels(id) ON DELETE CASCADE
      )`
    },
    {
      name: 'infractions',
      sql: `CREATE TABLE IF NOT EXISTS infractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER,
        expires_at INTEGER,
        active INTEGER DEFAULT 1
      )`
    },
    {
      name: 'warn_config',
      sql: `CREATE TABLE IF NOT EXISTS warn_config (
        guild_id TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        action TEXT NOT NULL,
        duration TEXT,
        UNIQUE(guild_id, threshold)
      )`
    },
    {
      name: 'giveaways',
      sql: `CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE,
        channel_id TEXT,
        guild_id TEXT,
        prize TEXT,
        winners_count INTEGER,
        end_timestamp INTEGER,
        host_id TEXT,
        ended INTEGER DEFAULT 0
      )`
    },
    {
      name: 'command_permissions',
      sql: `CREATE TABLE IF NOT EXISTS command_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        role_id TEXT NOT NULL,
        UNIQUE(guild_id, command_name, role_id)
      )`
    },
    {
      name: 'team_members',
      sql: `CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role_label TEXT NOT NULL,
        order_position INTEGER NOT NULL,
        social_link TEXT
      )`
    },
    {
      name: 'wallets',
      sql: `CREATE TABLE IF NOT EXISTS wallets (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        cash INTEGER DEFAULT 0 CHECK(cash >= 0),
        bank INTEGER DEFAULT 0 CHECK(bank >= 0),
        last_daily INTEGER,
        PRIMARY KEY (user_id, guild_id)
      )`
    },
    {
      name: 'economy_transactions',
      sql: `CREATE TABLE IF NOT EXISTS economy_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id TEXT,
        to_user_id TEXT,
        guild_id TEXT,
        amount INTEGER,
        type TEXT,
        created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
      )`
    },
    {
      name: 'shop_items',
      sql: `CREATE TABLE IF NOT EXISTS shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER,
        role_id TEXT,
        stock INTEGER DEFAULT -1
      )`
    },
    {
      name: 'inventory',
      sql: `CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        guild_id TEXT,
        item_id INTEGER,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (item_id) REFERENCES shop_items(id)
      )`
    },
    {
      name: 'job_progress',
      sql: `CREATE TABLE IF NOT EXISTS job_progress (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        job_slug TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        last_worked INTEGER DEFAULT 0,
        unlocked INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, job_slug)
      )`
    },
    {
      name: 'recipes',
      sql: `CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        result_item_id INTEGER NOT NULL,
        materials TEXT NOT NULL,
        required_job_level INTEGER DEFAULT 1,
        FOREIGN KEY (result_item_id) REFERENCES shop_items(id)
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
      name: 'idx_user_levels_xp',
      sql: `CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(xp DESC)`
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
      name: 'idx_autorole_entries_panel',
      sql: `CREATE INDEX IF NOT EXISTS idx_autorole_entries_panel ON autorole_entries(panel_id)`
    },
    {
      name: 'idx_infractions_active',
      sql: `CREATE INDEX IF NOT EXISTS idx_infractions_active ON infractions(active, type, expires_at)`
    },
    {
      name: 'idx_infractions_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_infractions_user ON infractions(user_id, guild_id)`
    },
    {
      name: 'idx_command_permissions_lookup',
      sql: `CREATE INDEX IF NOT EXISTS idx_command_permissions_lookup ON command_permissions(guild_id, command_name)`
    },
    {
      name: 'idx_team_members_order',
      sql: `CREATE INDEX IF NOT EXISTS idx_team_members_order ON team_members(guild_id, order_position)`
    },
    {
      name: 'idx_wallets_guild',
      sql: `CREATE INDEX IF NOT EXISTS idx_wallets_guild ON wallets(guild_id)`
    },
    {
      name: 'idx_transactions_users',
      sql: `CREATE INDEX IF NOT EXISTS idx_transactions_users ON economy_transactions(from_user_id, to_user_id)`
    },
    {
      name: 'idx_shop_guild',
      sql: `CREATE INDEX IF NOT EXISTS idx_shop_guild ON shop_items(guild_id)`
    },
    {
      name: 'idx_inventory_user',
      sql: `CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id, guild_id)`
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

/**
 * Crée une transaction
 * @param {Function} cb - La fonction à exécuter dans la transaction
 * @returns {Function} La fonction transactionnelle wrapper
 */
function transaction(cb) {
  if (!db) throw new Error('La base de données n\'est pas initialisée');
  return db.transaction(cb);
}

module.exports = {
  init,
  run,
  get,
  all,
  transaction,
  close
};
