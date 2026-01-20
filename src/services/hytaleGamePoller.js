/**
 * Service de polling pour hytale.game
 * Vérifie les nouveaux votes toutes les 2 minutes
 */

const axios = require('axios');
const voteHandler = require('../handlers/voteHandler');
const logger = require('../utils/logger');
const config = require('../config');

class HytaleGamePoller {
  constructor() {
    this.apiKey = process.env.HYTALEGAME_API_KEY;
    this.serverId = process.env.HYTALEGAME_SERVER_ID;
    this.baseUrl = 'https://hytale.game/api/v1';
    this.interval = null;
    this.lastCheck = Date.now();
  }

  /**
   * Démarre le polling (toutes les 2 minutes)
   */
  start() {
    console.log('[Hytale.game] 🚀 Démarrage du service de polling...');
    console.log(`[Hytale.game] API Key: ${this.apiKey ? '✅ Configuré' : '❌ Manquant'}`);
    console.log(`[Hytale.game] Server ID: ${this.serverId ? '✅ Configuré' : '❌ Manquant'}`);

    if (!this.apiKey || !this.serverId) {
      console.warn('[Hytale.game] Service non démarré: HYTALEGAME_API_KEY ou HYTALEGAME_SERVER_ID manquant');
      return;
    }

    // Vérification immédiate au démarrage
    this.checkVotes();

    // Puis toutes les 2 minutes
    this.interval = setInterval(() => {
      this.checkVotes();
    }, 2 * 60 * 1000); // 2 minutes
  }

  /**
   * Arrête le polling
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      logger.info('[Hytale.game] Service de polling arrêté');
    }
  }

  /**
   * Récupère les nouveaux votes depuis la dernière vérification
   */
  async checkVotes() {
    try {
      // Appel à l'API hytale.game
      const response = await axios.get(
        `${this.baseUrl}/servers/${this.serverId}/votes`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          params: {
            since: this.lastCheck // Uniquement les votes depuis la dernière vérification
          }
        }
      );

      const votes = response.data.votes || [];
      if (votes.length > 0) {
        logger.info(`[Hytale.game] ${votes.length} nouveau(x) vote(s) trouvé(s)`);
      }

      // Traiter chaque vote
      for (const vote of votes) {
        await this.processVote(vote);
      }

      // Mettre à jour le timestamp de dernière vérification
      this.lastCheck = Date.now();

    } catch (error) {
      logger.error(`[Hytale.game] Erreur lors de la vérification: ${error.message}`);

      // Si erreur 401, vérifier la clé API
      if (error.response?.status === 401) {
        logger.error('[Hytale.game] ⚠️  Clé API invalide ! Vérifiez HYTALEGAME_API_KEY');
      }
    }
  }

  /**
   * Traite un vote individuel
   */
  async processVote(voteData) {
    try {
      // Format attendu de hytale.game
      const {
        discord_id,    // ID Discord de l'utilisateur
        username,      // Pseudo
        voted_at,      // Timestamp du vote
        vote_id        // ID unique du vote
      } = voteData;

      const guildId = config.guildId;
      if (!guildId) {
        logger.error('[Hytale.game] Aucun serveur Discord configuré (GUILD_ID manquant dans config)');
        return;
      }

      // Traiter le vote via le handler
      await voteHandler.processVote({
        userId: discord_id,
        guildId: guildId,
        siteName: 'hytale.game',
        externalVoteId: vote_id,
        username: username,
        votedAt: voted_at
      }, 'api_polling');

    } catch (error) {
      logger.error(`[Hytale.game] Erreur traitement vote: ${error.message}`);
    }
  }
}

// Export singleton
module.exports = new HytaleGamePoller();
