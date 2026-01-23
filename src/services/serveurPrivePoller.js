/**
 * Service de polling pour serveur-prive.net
 * Vérifie les nouveaux votes toutes les 2 minutes
 */

const axios = require('axios');
const voteHandler = require('../handlers/voteHandler');
const config = require('../config');
const logger = require('../utils/logger');

class ServeurPrivePoller {
  constructor() {
    this.token = process.env.SERVEURPRIVE_TOKEN;
    this.baseUrl = 'https://serveur-prive.net/api/v1';
    this.interval = null;
    this.lastCheck = Date.now();
  }

  /**
   * Démarre le polling (toutes les 2 minutes)
   */
  start() {
    logger.info('[Serveur-prive.net] 🚀 Démarrage du service de polling...');
    logger.info(`[Serveur-prive.net] Token: ${this.token ? '✅ Configuré' : '❌ Manquant'}`);

    if (!this.token) {
      logger.warn('[Serveur-prive.net] Service non démarré: SERVEURPRIVE_TOKEN manquant');
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
      // Endpoint selon ticket #023: GET https://serveur-prive.net/api/v1/servers/TOKEN/votes
      const response = await axios.get(
        `${this.baseUrl}/servers/${this.token}/votes`,
        {
          headers: {
            'Accept': 'application/json'
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

      const guildId = config.guildId || process.env.GUILD_ID;
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
      if (voted_at) {
        // Le format peut être timestamp (s) ou string
        if (typeof voted_at === 'number') timestamp = voted_at * 1000;
        else timestamp = new Date(voted_at).getTime();
      }
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

      logger.success(`[Serveur-prive.net] ✅ Vote traité: ${username}`);

    } catch (error) {
      logger.error(`[Serveur-prive.net] Erreur traitement vote: ${error.message}`);
    }
  }
}

module.exports = new ServeurPrivePoller();
