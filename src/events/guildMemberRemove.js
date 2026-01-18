/**
 * Événement guildMemberRemove
 * Se déclenche lorsqu'un membre quitte le serveur.
 */
const { updateMemberCounter } = require('../utils/memberCounter');
const logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  /**
   * Exécute la logique de l'événement
   * @param {import('discord.js').GuildMember} member - Le membre qui a quitté
   */
  async execute(member) {
    try {
      logger.info(`👋 ${member.user.tag} a quitté ${member.guild.name}`);

      // Mettre à jour le compteur
      await updateMemberCounter(member.guild);

    } catch (error) {
      logger.error('Erreur dans guildMemberRemove:', error);
    }
  }
};
