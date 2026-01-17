/**
 * Événement Warn
 * Capture les avertissements du client Discord.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.Warn,
  once: false,
  /**
   * Exécute l'événement
   * @param {string} info
   */
  execute(info) {
    logger.warn(`⚠️ Warning Discord : ${info}`);
  },
};
