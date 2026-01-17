/**
 * Événement Error
 * Capture les erreurs globales du client Discord.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.Error,
  once: false,
  /**
   * Exécute l'événement
   * @param {Error} error
   */
  execute(error) {
    logger.error(`❌ Erreur Discord : ${error.message}`);
  },
};
