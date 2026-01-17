/**
 * Gestionnaire de commandes (Command Handler)
 * Charge dynamiquement les commandes depuis le dossier src/commands
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Charge les commandes dans le client Discord
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const commandFolders = fs.readdirSync(commandsPath);

  let commandsCount = 0;

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    // Vérifie si c'est un dossier
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        const command = require(filePath);

        // Vérification de la structure de la commande
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          commandsCount++;
          // Logger.debug(`Commande chargée : ${command.data.name}`);
        } else {
          logger.warn(`La commande ${filePath} manque de propriétés 'data' ou 'execute'.`);
        }
      } catch (error) {
        logger.error(`Erreur lors du chargement de la commande ${filePath}: ${error.message}`);
      }
    }
  }

  logger.success(`${commandsCount} commandes chargées avec succès.`);
};
