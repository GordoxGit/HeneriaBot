/**
 * Service général pour gérer les votes détectés via webhooks Discord
 */

const db = require('../database/db');
const logger = require('../utils/logger');

class WebhookVoteService {
  /**
   * Enregistre la configuration d'un webhook de vote
   */
  static registerWebhook(guildId, siteName, webhookId, channelId) {
    const result = db.run(`
      UPDATE vote_sites
      SET detection_method = 'webhook',
          webhook_id = ?,
          webhook_channel_id = ?
      WHERE guild_id = ? AND name = ?
    `, [webhookId, channelId, guildId, siteName]);

    // Tentative de fallback sur les noms alternatifs si la mise à jour n'a rien touché
    if (result.changes === 0) {
      if (siteName === 'hytale.game') {
        db.run(`
          UPDATE vote_sites
          SET detection_method = 'webhook', webhook_id = ?, webhook_channel_id = ?
          WHERE guild_id = ? AND name = 'Hytale Game Serveurs'
        `, [webhookId, channelId, guildId]);
      } else if (siteName === 'hytale-servs.fr') {
        db.run(`
          UPDATE vote_sites
          SET detection_method = 'webhook', webhook_id = ?, webhook_channel_id = ?
          WHERE guild_id = ? AND name = 'Hytale-Servs'
        `, [webhookId, channelId, guildId]);
      }
    }

    logger.info(`[WebhookVote] Webhook enregistré pour ${siteName}`);
  }

  /**
   * Récupère la config d'un webhook par son ID
   */
  static getWebhookConfig(webhookId) {
    return db.get(`
      SELECT guild_id, name, reward_xp, reward_money
      FROM vote_sites
      WHERE webhook_id = ? AND detection_method = 'webhook'
    `, [webhookId]);
  }

  /**
   * Récupère tous les webhooks configurés
   */
  static getAllWebhooks(guildId) {
    return db.all(`
      SELECT name, webhook_id, webhook_channel_id
      FROM vote_sites
      WHERE guild_id = ? AND detection_method = 'webhook'
    `, [guildId]);
  }

  /**
   * Vérifie si un message provient d'un webhook de vote configuré
   */
  static isVoteWebhook(message) {
    // Vérifier que c'est un webhook
    if (!message.webhookId) return false;

    // Vérifier si ce webhook est enregistré
    const config = this.getWebhookConfig(message.webhookId);
    return config !== undefined;
  }
}

module.exports = WebhookVoteService;
