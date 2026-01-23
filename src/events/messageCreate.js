const { Events } = require('discord.js');
const WebhookVoteService = require('../services/webhookVoteService');
const HytaleGameWebhook = require('../services/hytaleGameWebhook');
const HytaleServsWebhook = require('../services/hytaleServsWebhook');
const voteHandler = require('../handlers/voteHandler');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    // Ignorer les messages normaux (non-webhooks)
    if (!message.webhookId) return;

    // Ignorer les messages du bot lui-même (sauf si c'est un webhook)
    // Note: message.author.bot est true pour les webhooks

    // Vérifier si c'est un webhook de vote
    if (!WebhookVoteService.isVoteWebhook(message)) return;

    logger.info('[Webhook Vote] Message webhook détecté');

    try {
      // Récupérer la config du webhook
      const config = WebhookVoteService.getWebhookConfig(message.webhookId);

      if (!config) {
        logger.warn('[Webhook Vote] Webhook non configuré');
        return;
      }

      let voteData = null;

      // Parser selon le site
      if (config.name.includes('hytale.game') || config.name === 'Hytale Game Serveurs') {
        voteData = await HytaleGameWebhook.parse(message);
      } else if (config.name.includes('hytale-servs.fr') || config.name === 'Hytale-Servs') {
        voteData = await HytaleServsWebhook.parse(message);
      } else {
        logger.warn(`[Webhook Vote] Site inconnu: ${config.name}`);
        return;
      }

      if (!voteData) {
        logger.warn('[Webhook Vote] Impossible de parser le vote');
        return;
      }

      // Résoudre le Discord ID si pas fourni
      let discordId = voteData.discordId;

      if (!discordId) {
        discordId = voteHandler.resolveUsernameToDiscordId(
          voteData.username,
          voteData.siteName,
          config.guild_id
        );
      }

      if (!discordId) {
        logger.warn(`[Webhook Vote] Impossible de résoudre: ${voteData.username}`);
        return;
      }

      // Traiter le vote
      await voteHandler.processVote({
        userId: discordId,
        guildId: config.guild_id,
        siteName: voteData.siteName,
        externalVoteId: voteData.externalVoteId,
        username: voteData.username,
        votedAt: voteData.votedAt
      }, 'webhook');

      logger.success(`[Webhook Vote] ✅ Vote traité: ${voteData.username}`);

    } catch (error) {
      logger.error(`[Webhook Vote] Erreur traitement: ${error.message}`);
    }
  }
};
