/**
 * Événement GuildMemberAdd
 * Se déclenche lorsqu'un nouveau membre rejoint un serveur.
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  /**
   * Exécute l'événement
   * @param {import('discord.js').GuildMember} member
   */
  execute(member) {
    logger.info(`👋 Nouveau membre : ${member.user.tag} (ID: ${member.id})`);
  },
};
