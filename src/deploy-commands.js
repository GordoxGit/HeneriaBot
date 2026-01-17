/**
 * Script de déploiement des commandes Slash
 * Usage:
 *   node src/deploy-commands.js --guild  (Déploiement sur le serveur de test)
 *   node src/deploy-commands.js --global (Déploiement global - Production)
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

// Analyse des arguments
const args = process.argv.slice(2);
const isGlobal = args.includes('--global');
const isGuild = args.includes('--guild');

// Vérification des arguments
if (!isGlobal && !isGuild) {
  logger.warn('Aucun mode spécifié. Utilisation du mode --guild par défaut.');
  logger.info('Utilisez --global pour un déploiement global ou --guild pour le serveur de test.');
}

// Vérification de la configuration
if (!config.token || !config.clientId) {
  logger.error('Configuration manquante : token ou clientId introuvable dans le fichier .env ou config.js');
  process.exit(1);
}

if (!isGlobal && !config.guildId) {
  logger.error('Configuration manquante : guildId requis pour le déploiement local (mode --guild)');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

logger.info('Lecture des commandes...');

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);

  // Ignore les fichiers à la racine de commands/, ne traite que les dossiers
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    try {
      const command = require(filePath);

      // Validation de la structure de la commande
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        // logger.debug(`Commande chargée pour déploiement : ${command.data.name}`);
      } else {
        logger.warn(`La commande ${filePath} manque de propriétés 'data' ou 'execute'.`);
      }
    } catch (error) {
      logger.error(`Erreur lors de la lecture de la commande ${filePath}: ${error.message}`);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    const mode = isGlobal ? 'Global' : `Guild (${config.guildId})`;
    logger.info(`Début du rafraîchissement de ${commands.length} commandes d'application [Mode: ${mode}]`);

    let data;
    if (isGlobal) {
      // Déploiement global (mise à jour peut prendre jusqu'à 1 heure)
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
    } else {
      // Déploiement sur le serveur spécifique (instantané)
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
    }

    logger.success(`Déploiement réussi ! ${data.length} commandes enregistrées.`);
  } catch (error) {
    logger.error(`Erreur lors du déploiement des commandes : ${error}`);
    console.error(error);
  }
})();
