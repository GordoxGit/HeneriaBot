/**
 * Service de polling pour top-serveurs.net
 */

const axios = require('axios');
const db = require('../database/db');
const voteHandler = require('../handlers/voteHandler');
const config = require('../config');
const logger = require('../utils/logger');

class TopServeursPoller {
  constructor() {
    this.apiKey = process.env.TOPSERVEURS_API_KEY;
    this.baseUrl = 'https://api.top-serveurs.net/v1';
    this.serverSlug = 'heneria'; // À adapter
    this.interval = null;
    this.lastCheck = Date.now();
  }

  start() {
    logger.info('[Top-serveurs.net] 🚀 Démarrage du service de polling...');
    logger.info(`[Top-serveurs.net] API Key: ${this.apiKey ? '✅' : '❌'}`);

    if (!this.apiKey) {
      logger.warn('[Top-serveurs.net] Service non démarré: TOPSERVEURS_API_KEY manquant');
      return;
    }

    // Test de connexion
    this.testConnection();

    // Polling toutes les 2 minutes
    this.checkVotes();
    this.interval = setInterval(() => {
      this.checkVotes();
    }, 2 * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      logger.info('[Top-serveurs.net] Service arrêté');
    }
  }

  async testConnection() {
    try {
      logger.info('[Top-serveurs.net] 🔍 Test de connexion...');

      const response = await axios.get(
        `${this.baseUrl}/votes/server/${this.serverSlug}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      logger.success('[Top-serveurs.net] ✅ Connexion réussie !');
      // logger.debug('[Top-serveurs.net] Données:', response.data);

    } catch (error) {
      logger.error('[Top-serveurs.net] ❌ Erreur de connexion:');
      logger.error(`  Status: ${error.response?.status}`);
      logger.error(`  Message: ${error.response?.data}`);
      logger.error(`  URL: ${error.config?.url}`);
    }
  }

  async checkVotes() {
    try {
      logger.info('[Top-serveurs.net] 🔄 Vérification des votes...');

      const response = await axios.get(
        `${this.baseUrl}/votes/server/${this.serverSlug}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          },
          params: {
            since: Math.floor(this.lastCheck / 1000) // Timestamp en secondes
          },
          timeout: 10000
        }
      );

      const votes = response.data.votes || response.data.data || [];
      if (votes.length > 0) {
        logger.info(`[Top-serveurs.net] ${votes.length} vote(s) trouvé(s)`);
      }

      for (const vote of votes) {
        await this.processVote(vote);
      }

      this.lastCheck = Date.now();

    } catch (error) {
      logger.error(`[Top-serveurs.net] Erreur checkVotes: ${error.message}`);
    }
  }

  async processVote(voteData) {
    try {
      // Format estimé (à adapter selon la vraie API)
      const {
        id: voteId,
        username,
        discord_id,
        voted_at,
        timestamp
      } = voteData;

      const discordId = discord_id || null;
      const votedAt = voted_at ? new Date(voted_at).getTime() :
                      timestamp ? new Date(timestamp).getTime() :
                      Date.now();

      // Vérifier si déjà traité
      const existing = db.get(
        'SELECT id FROM user_votes WHERE external_vote_id = ?',
        [voteId]
      );

      if (existing) {
        // Déjà traité, on ne spamme pas les logs sauf debug
        // logger.debug(`[Top-serveurs.net] Vote ${voteId} déjà traité`);
        return;
      }

      const guildId = config.guildId || process.env.GUILD_ID;
      if (!guildId) return;

      // Résoudre le Discord ID
      let resolvedDiscordId = discordId;

      if (!resolvedDiscordId) {
        // Utiliser le système de liaison
        resolvedDiscordId = voteHandler.resolveUsernameToDiscordId(
          username,
          'top-serveurs.net',
          guildId
        );
      }

      if (!resolvedDiscordId) {
        logger.warn(`[Top-serveurs.net] ⚠️ Impossible de résoudre: ${username}`);
        return;
      }

      // Traiter le vote
      await voteHandler.processVote({
        userId: resolvedDiscordId,
        guildId: guildId,
        siteName: 'top-serveurs.net',
        externalVoteId: voteId,
        username: username,
        votedAt: votedAt
      }, 'api_polling');

      logger.success(`[Top-serveurs.net] ✅ Vote traité: ${username}`);

    } catch (error) {
      logger.error(`[Top-serveurs.net] Erreur processVote: ${error}`);
    }
  }
}

module.exports = new TopServeursPoller();
