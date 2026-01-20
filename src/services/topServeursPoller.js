/**
 * Service de polling pour top-serveurs.net
 * Vérifie les nouveaux votes toutes les 2 minutes
 */

const axios = require('axios');
const voteHandler = require('../handlers/voteHandler');
const logger = require('../utils/logger');
const config = require('../config');

class TopServeursPoller {
  constructor() {
    this.apiKey = process.env.TOPSERVEURS_API_KEY; // ✅ Pas TOKEN
    // URL hypothétique, à ajuster selon la documentation réelle
    this.baseUrl = 'https://api.top-serveurs.net/v1';
    this.interval = null;
    this.lastCheck = Date.now();
  }

  /**
   * Démarre le polling (toutes les 2 minutes)
   */
  start() {
    console.log('[Top-serveurs.net] 🚀 Démarrage du service de polling...');
    console.log(`[Top-serveurs.net] API Key: ${this.apiKey ? '✅ Configuré' : '❌ Manquant'}`);

    if (!this.apiKey) {
      console.warn('[Top-serveurs.net] Service non démarré: TOPSERVEURS_API_KEY manquant');
      return;
    }

    // Vérification immédiate
    this.checkVotes();

    // Puis toutes les 2 minutes
    this.interval = setInterval(() => {
      this.checkVotes();
    }, 2 * 60 * 1000);
  }

  /**
   * Arrête le polling
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      logger.info('[Top-serveurs.net] Service de polling arrêté');
    }
  }

  /**
   * Récupère les nouveaux votes
   */
  async checkVotes() {
    try {
      // On suppose une requête GET /votes avec le token
      const response = await axios.get(
        `${this.baseUrl}/votes`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          },
          params: {
             // Si l'API supporte le filtrage par date
             // since: Math.floor(this.lastCheck / 1000)
             token: this.apiKey // Parfois passé en param
          }
        }
      );

      const votes = response.data.votes || [];

      if (votes.length > 0) {
        logger.info(`[Top-serveurs.net] ${votes.length} nouveau(x) vote(s) trouvé(s)`);
      }

      for (const vote of votes) {
        await this.processVote(vote);
      }

      this.lastCheck = Date.now();

    } catch (error) {
      // On log pas en erreur si c'est 404 (pas de votes ?) ou 401
      if (error.response && error.response.status === 404) return;

      logger.error(`[Top-serveurs.net] Erreur lors de la vérification: ${error.message}`);
    }
  }

  /**
   * Traite un vote individuel
   */
  async processVote(voteData) {
    try {
      const { username, timestamp, ip } = voteData;
      // Format attendu: { timestamp: 1234567890, username: "...", ip: "..." }

      const guildId = config.guildId;
      if (!guildId) return;

      // Résoudre le username en Discord ID
      const discordId = voteHandler.resolveUsernameToDiscordId(
        username,
        'top-serveurs.net',
        guildId
      );

      if (!discordId) {
        // Vote non lié
        return;
      }

      // Timestamp
      const votedAt = timestamp ? timestamp * 1000 : Date.now();

      // ID unique
      const externalVoteId = `top-serveurs_${username}_${votedAt}`;

      await voteHandler.processVote({
        userId: discordId,
        guildId: guildId,
        siteName: 'top-serveurs.net',
        externalVoteId: externalVoteId,
        username: username,
        votedAt: votedAt
      }, 'api_polling');

    } catch (error) {
      logger.error(`[Top-serveurs.net] Erreur traitement vote: ${error.message}`);
    }
  }
}

module.exports = new TopServeursPoller();
