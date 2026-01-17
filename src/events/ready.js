/**
 * Événement Ready
 * Se déclenche lorsque le bot est connecté et prêt.
 */

const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * Exécute l'événement
   * @param {import('discord.js').Client} client
   */
  execute(client) {
    const serverCount = client.guilds.cache.size;
    // On calcule le nombre total d'utilisateurs sur tous les serveurs
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    logger.success(`✅ ${client.user.tag} connecté • ${serverCount} serveurs • ${userCount} utilisateurs`);

    // Configuration du statut du bot
    client.user.setPresence({
      activities: [{ name: 'Heneria • v1.0.0', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
