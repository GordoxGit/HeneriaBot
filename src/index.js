/**
 * Point d'entrée principal du bot Heneria
 */

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./database/db');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

// Initialisation du client Discord avec les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Collection pour stocker les commandes
client.commands = new Collection();

/**
 * Fonction principale d'initialisation
 */
async function init() {
  try {
    logger.info('Démarrage du bot Heneria...');

    // Initialisation de la base de données
    db.init();

    // Chargement des handlers
    loadCommands(client);
    loadEvents(client);

    // Vérification du token
    if (!config.token) {
      throw new Error('DISCORD_TOKEN non défini dans le fichier .env');
    }

    // Connexion à Discord
    await client.login(config.token);

  } catch (error) {
    logger.error(`Erreur fatale lors du démarrage : ${error.message}`);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Rejet de promesse non géré : ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Exception non gérée : ${error.message}`);
  // En production, on pourrait envisager de redémarrer le processus proprement
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Arrêt du bot...');
  db.close();
  process.exit(0);
});

// Lancement
init();
