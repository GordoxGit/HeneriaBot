/**
 * Parser pour les webhooks de hytale-servs.fr
 */

const voteHandler = require('../handlers/voteHandler');
const WebhookVoteService = require('./webhookVoteService');
const logger = require('../utils/logger');

class HytaleServsWebhook {
  /**
   * Parse un message webhook de hytale-servs.fr
   * @param {Message} message - Message Discord du webhook
   */
  static async parse(message) {
    try {
      const config = WebhookVoteService.getWebhookConfig(message.webhookId);
      // Adaptation pour supporter les différents noms possibles en DB
      if (!config || (!config.name.includes('hytale-servs.fr') && config.name !== 'Hytale-Servs')) {
        return null;
      }

      logger.info('[hytale-servs.fr Webhook] Message reçu');

      // Format estimé (à adapter selon la vraie doc)
      const embed = message.embeds[0];
      if (!embed) {
        logger.warn('[hytale-servs.fr Webhook] Pas d\'embed');
        return null;
      }

      let username = null;
      let discordId = null;

      // Extraire depuis les fields
      if (embed.fields) {
        for (const field of embed.fields) {
          if (field.name.toLowerCase().includes('joueur') ||
              field.name.toLowerCase().includes('pseudo')) {
            username = field.value;
          }
          if (field.name.toLowerCase().includes('discord')) {
            discordId = field.value.replace(/[<@!>]/g, '');
          }
        }
      }

      // Fallback: chercher dans le content
      if (!username && message.content) {
        const match = message.content.match(/(\w+)\s+a voté/i);
        if (match) username = match[1];
      }

      if (!username) {
        logger.warn('[hytale-servs.fr Webhook] Impossible d\'extraire le username');
        return null;
      }

      logger.info(`[hytale-servs.fr Webhook] Vote détecté: ${username}`);

      return {
        siteName: config.name,
        username: username,
        discordId: discordId,
        votedAt: Date.now(),
        externalVoteId: `hytaleservs_${username}_${Date.now()}`
      };

    } catch (error) {
      logger.error(`[hytale-servs.fr Webhook] Erreur parse: ${error.message}`);
      return null;
    }
  }
}

module.exports = HytaleServsWebhook;
