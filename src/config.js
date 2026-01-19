/**
 * Configuration centralisée du projet
 */

require('dotenv').config();

module.exports = {
  // Configuration du bot
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  environment: process.env.ENVIRONMENT || 'development',
  apiPort: process.env.API_PORT || 3000,

  // Couleurs Heneria
  colors: {
    main: '#780CED',    // Violet principal
    dark: '#1D0342',    // Bleu nuit
    light: '#F2E1FF',   // Blanc rosé
  },

  // Chemins
  paths: {
    commands: 'src/commands',
    events: 'src/events',
    database: './data/heneria.db',
  }
};
