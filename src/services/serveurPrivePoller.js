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
    // URL basée sur la documentation standard ou suggestion
    this.baseUrl = 'https://serveur-prive.net/api/v1';
    this.interval = null;
    this.lastCheck = Date.now();
  }

  /**
   * Démarre le polling (toutes les 2 minutes)
   */
  start() {
    console.log('[Serveur-prive.net] 🚀 Démarrage du service de polling...');
    console.log(`[Serveur-prive.net] Token: ${this.token ? '✅ Configuré' : '❌ Manquant'}`);

    if (!this.token) {
      console.warn('[Serveur-prive.net] Service non démarré: SERVEURPRIVE_TOKEN manquant');
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
        `${this.baseUrl}/votes`,
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

      // Support des formats possibles (data ou votes)
      const votes = response.data.data || response.data.votes || [];

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
      const { username, voted_at, created_at, id, vote_id } = voteData;

      const guildId = config.guildId;
      if (!guildId) return;

      // 1. Essayer de récupérer l'ID Discord directement
      let discordId = voteData.discord_id || voteData.user_id;

      // 2. Sinon, essayer de résoudre via le système de liaison
      if (!discordId) {
        discordId = voteHandler.resolveUsernameToDiscordId(
          username,
          'serveur-prive.net',
          guildId
        );
      }

      if (!discordId) {
        // Vote non lié, on ignore silencieusement (ou log debug)
        return;
      }

      // Déterminer le timestamp
      let timestamp = Date.now();
      if (voted_at) timestamp = voted_at * 1000; // UNIX timestamp (seconds)
      else if (created_at) timestamp = new Date(created_at).getTime();

      // Construire un ID unique pour éviter les doublons
      const externalVoteId = id || vote_id || `serveur-prive_${username}_${timestamp}`;

      await voteHandler.processVote({
        userId: discordId,
        guildId: guildId,
        siteName: 'serveur-prive.net',
        externalVoteId: String(externalVoteId),
        username: username,
        votedAt: timestamp
      }, 'api_polling');

    } catch (error) {
      logger.error(`[Serveur-prive.net] Erreur traitement vote: ${error.message}`);
    }
  }
}

module.exports = new ServeurPrivePoller();
