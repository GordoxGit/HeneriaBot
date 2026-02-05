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
  let eventsCount = 0;

  /**
   * Fonction récursive pour lire les fichiers d'événements
   * @param {string} dirPath - Chemin du dossier à analyser
   */
  const loadEventsFromDir = (dirPath) => {
    // Vérifier si le dossier existe
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        loadEventsFromDir(filePath);
      } else if (file.endsWith('.js')) {
        try {
          const eventModule = require(filePath);

          // Support pour l'export d'un tableau d'événements ou d'un événement unique
          const events = Array.isArray(eventModule) ? eventModule : [eventModule];

          for (const event of events) {
            if (!event.name || !event.execute) {
              logger.warn(`L'événement ${filePath} est invalide (name ou execute manquant)`);
              continue;
            }

            if (event.once) {
              client.once(event.name, (...args) => event.execute(...args));
            } else {
              client.on(event.name, (...args) => event.execute(...args));
            }
            eventsCount++;
          }
        } catch (error) {
          logger.error(`Erreur lors du chargement de l'événement ${filePath}: ${error.message}`);
        }
      }
    }
  };

  loadEventsFromDir(eventsPath);
  logger.success(`${eventsCount} événements chargés avec succès.`);
};
