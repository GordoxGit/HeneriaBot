/**
 * Service de polling pour serveur-prive.net
 * Vérifie les nouveaux votes toutes les 2 minutes
 */

const axios = require('axios');
const voteHandler = require('../handlers/voteHandler');
const logger = require('../utils/logger');
const config = require('../config');

class ServeurPrivePoller {
  constructor() {
    this.token = process.env.SERVEURPRIVE_TOKEN;
    this.serverId = process.env.SERVEURPRIVE_SERVER_ID;
    // URL basée sur la documentation standard ou suggestion
    this.baseUrl = 'https://serveur-prive.net/api/v1';
    this.interval = null;
    this.lastCheck = Date.now();
  }

  /**
   * Démarre le polling (toutes les 2 minutes)
   */
  start() {
    if (!this.token || !this.serverId) {
      logger.warn('[Serveur-prive.net] Service non démarré: SERVEURPRIVE_TOKEN ou SERVEURPRIVE_SERVER_ID manquant');
      return;
    }

    logger.info('[Serveur-prive.net] Démarrage du service de polling...');

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
      logger.info('[Serveur-prive.net] Service de polling arrêté');
    }
  }

  /**
   * Récupère les nouveaux votes
   */
  async checkVotes() {
    try {
      // Note: L'endpoint exact dépend de la documentation officielle.
      // On suppose une structure standard ici.
      const response = await axios.get(
        `${this.baseUrl}/servers/${this.serverId}/votes`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/json'
          },
          params: {
            since: this.lastCheck
          }
        }
      );

      const votes = response.data.votes || [];
      if (votes.length > 0) {
        logger.info(`[Serveur-prive.net] ${votes.length} nouveau(x) vote(s) trouvé(s)`);
      }

      for (const vote of votes) {
        await this.processVote(vote);
      }

      this.lastCheck = Date.now();

    } catch (error) {
      logger.error(`[Serveur-prive.net] Erreur lors de la vérification: ${error.message}`);
    }
  }

  /**
   * Traite un vote individuel
   */
  async processVote(voteData) {
    try {
      // Adaptation des champs selon format supposé
      const {
        discord_id,
        username,
        created_at,
        id
      } = voteData;

      const guildId = config.guildId;
      if (!guildId) return;

      await voteHandler.processVote({
        userId: discord_id || voteData.user_id, // Fallback
        guildId: guildId,
        siteName: 'serveur-prive.net',
        externalVoteId: id || voteData.vote_id,
        username: username,
        votedAt: created_at ? new Date(created_at).getTime() : Date.now()
      }, 'api_polling');

    } catch (error) {
      logger.error(`[Serveur-prive.net] Erreur traitement vote: ${error.message}`);
    }
  }
}

module.exports = new ServeurPrivePoller();
