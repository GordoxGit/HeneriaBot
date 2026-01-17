/**
 * Événement MessageCreate
 * Se déclenche lorsqu'un message est envoyé.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  /**
   * Exécute l'événement
   * @param {import('discord.js').Message} message
   */
  execute(message) {
    // Ignore les messages des bots
    if (message.author.bot) return;

    logger.debug(`Message reçu de ${message.author.tag} dans #${message.channel.name}: ${message.content}`);
  },
};
