CREATE TABLE IF NOT EXISTS vote_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,                    -- Nom d'affichage (ex: "Hytale Game")
    slug TEXT NOT NULL,                    -- Identifiant unique (ex: "hytale-game")
    url TEXT NOT NULL,                     -- URL de la page de vote
    api_type TEXT NOT NULL,                -- 'webhook', 'polling_otp', 'polling_check'
    api_base_url TEXT,                     -- URL de base de l'API
    api_token TEXT,                        -- Token/clé API
    webhook_channel_id TEXT,               -- ID salon pour webhooks entrants
    cooldown_hours INTEGER DEFAULT 24,     -- Cooldown entre votes (en heures)
    reward_xp INTEGER DEFAULT 50,          -- XP donnée par vote
    reward_money INTEGER DEFAULT 100,      -- Monnaie donnée par vote
    enabled INTEGER DEFAULT 1,             -- Site actif ou non
    position INTEGER DEFAULT 0,            -- Ordre d'affichage
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(guild_id, slug)
);

CREATE TABLE IF NOT EXISTS user_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                 -- Discord User ID
    guild_id TEXT NOT NULL,
    site_slug TEXT NOT NULL,               -- Référence au slug du site
    voted_at INTEGER NOT NULL,             -- Timestamp du vote
    external_vote_id TEXT,                 -- ID du vote côté site externe
    verification_method TEXT,              -- 'webhook', 'otp', 'polling', 'manual'
    otp_token TEXT,                        -- Token OTP utilisé (si applicable)
    claimed INTEGER DEFAULT 0,             -- Vote réclamé côté API externe
    rewards_given INTEGER DEFAULT 0,       -- Récompenses attribuées
    UNIQUE(external_vote_id),
    FOREIGN KEY (guild_id, site_slug) REFERENCES vote_sites(guild_id, slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_votes_user ON user_votes(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_site ON user_votes(site_slug, guild_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_time ON user_votes(voted_at);

CREATE TABLE IF NOT EXISTS vote_otp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    site_slug TEXT NOT NULL,
    otp_token TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    UNIQUE(otp_token)
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON vote_otp_sessions(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON vote_otp_sessions(expires_at);

CREATE TABLE IF NOT EXISTS vote_stats (
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
);

CREATE TABLE IF NOT EXISTS vote_rewards_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    reward_type TEXT NOT NULL,             -- 'xp', 'money', 'role'
    base_value INTEGER NOT NULL,           -- Valeur de base
    streak_bonus_percent INTEGER DEFAULT 0, -- Bonus % par jour de streak
    max_streak_bonus INTEGER DEFAULT 100,   -- Bonus max en %
    enabled INTEGER DEFAULT 1,
    UNIQUE(guild_id, reward_type)
);
