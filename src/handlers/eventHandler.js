/**
 * Gestionnaire d'événements (Event Handler)
 * Charge dynamiquement les événements depuis le dossier src/events
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Charge les événements dans le client Discord
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  let eventsCount = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      eventsCount++;
    } catch (error) {
      logger.error(`Erreur lors du chargement de l'événement ${filePath}: ${error.message}`);
    }
  }

  logger.success(`${eventsCount} événements chargés avec succès.`);
};
