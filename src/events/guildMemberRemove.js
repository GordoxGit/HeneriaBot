/**
 * Événement GuildMemberRemove
 * Se déclenche lorsqu'un membre quitte le serveur (départ, kick, ban).
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { updateMemberCounter } = require('../utils/memberCounter');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  /**
   * Exécute l'événement
   * @param {import('discord.js').GuildMember} member
   */
  async execute(member) {
    logger.info(`👋 Départ de membre : ${member.user.tag} (ID: ${member.id})`);

    try {
      // Mise à jour du compteur de membres
      await updateMemberCounter(member.guild);
    } catch (error) {
      logger.error(`❌ Erreur lors de la mise à jour du compteur (départ) : ${error.message}`);
    }
  },
};
