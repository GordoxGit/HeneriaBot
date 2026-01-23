/**
 * Parser pour les webhooks de hytale.game
 */

const voteHandler = require('../handlers/voteHandler');
const WebhookVoteService = require('./webhookVoteService');
const logger = require('../utils/logger');

class HytaleGameWebhook {
  /**
   * Parse un message webhook de hytale.game
   * @param {Message} message - Message Discord du webhook
   */
  static async parse(message) {
    try {
      // Vérifier que c'est bien un webhook hytale.game
      const config = WebhookVoteService.getWebhookConfig(message.webhookId);
      // Note: Le nom peut varier selon l'initialisation DB ('hytale.game' vs 'Hytale Game Serveurs')
      // On vérifie si le nom contient 'hytale.game' ou est égal
      if (!config || (!config.name.includes('hytale.game') && config.name !== 'Hytale Game Serveurs')) {
        return null;
      }

      logger.info(`[hytale.game Webhook] Message reçu: ${message.content || 'Embed'}`);

      // Parser le contenu (à adapter selon le format réel)
      const embed = message.embeds[0];
      if (!embed) {
        logger.warn('[hytale.game Webhook] Pas d\'embed trouvé');
        return null;
      }

      // Extraire les données depuis l'embed
      let username = null;
      let discordId = null;

      // Méthode 1 : Chercher dans les fields
      if (embed.fields) {
        for (const field of embed.fields) {
          if (field.name.toLowerCase().includes('pseudo') ||
              field.name.toLowerCase().includes('username')) {
            username = field.value;
          }
          if (field.name.toLowerCase().includes('discord') ||
              field.name.toLowerCase().includes('id')) {
            discordId = field.value.replace(/[<@!>]/g, ''); // Nettoyer les mentions
          }
        }
      }

      // Méthode 2 : Chercher dans la description
      if (!username && embed.description) {
        const match = embed.description.match(/\*\*(.+?)\*\*/);
        if (match) username = match[1];
      }

      if (!username) {
        logger.warn('[hytale.game Webhook] Impossible d\'extraire le username');
        return null;
      }

      logger.info(`[hytale.game Webhook] Vote détecté: ${username} ${discordId ? `(${discordId})` : ''}`);

      return {
        siteName: config.name, // Utiliser le nom réel en BDD
        username: username,
        discordId: discordId, // Peut être null
        votedAt: Date.now(),
        externalVoteId: `hytalegame_${username}_${Date.now()}`
      };

    } catch (error) {
      logger.error(`[hytale.game Webhook] Erreur parse: ${error.message}`);
      return null;
    }
  }
}

module.exports = HytaleGameWebhook;
