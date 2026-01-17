/**
 * Utilitaire de journalisation (Logger) pour le bot Heneria
 * Gère l'affichage coloré en console et l'enregistrement dans des fichiers de logs quotidiens.
 */

const fs = require('fs');
const path = require('path');

// Codes couleurs ANSI pour la console
const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m', // Cyan
  success: '\x1b[32m', // Vert
  warn: '\x1b[33m', // Jaune
  error: '\x1b[31m', // Rouge
  debug: '\x1b[35m', // Magenta
  gray: '\x1b[90m', // Gris pour le timestamp
};

// Chemin du dossier de logs
const logDir = path.join(__dirname, '../../logs');

// Assure que le dossier de logs existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Formate le timestamp actuel
 * @returns {string} Date formatée [YYYY-MM-DD HH:mm:ss]
 */
function getTimestamp() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('fr-FR', { hour12: false });
  return `${date} ${time}`;
}

/**
 * Obtient le nom du fichier de log du jour
 * @returns {string} Chemin complet du fichier log
 */
function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logDir, `bot-${date}.log`);
}

/**
 * Écrit un message dans le fichier de log et la console
 * @param {string} level - Niveau de log (info, success, warn, error, debug)
 * @param {string} message - Message à logger
 * @param {string} color - Code couleur ANSI pour la console
 */
function log(level, message, color) {
  const timestamp = getTimestamp();
  const fileContent = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  const consoleContent = `${colors.gray}[${timestamp}]${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} ${message}`;

  // Écriture console
  console.log(consoleContent);

  // Écriture fichier
  try {
    fs.appendFileSync(getLogFilePath(), fileContent);
  } catch (err) {
    console.error(`${colors.error}[ERREUR LOGGER] Impossible d'écrire dans le fichier log : ${err.message}${colors.reset}`);
  }
}

module.exports = {
  /**
   * Log d'information standard
   * @param {string} message
   */
  info: (message) => log('info', message, colors.info),

  /**
   * Log de succès
   * @param {string} message
   */
  success: (message) => log('success', message, colors.success),

  /**
   * Log d'avertissement
   * @param {string} message
   */
  warn: (message) => log('warn', message, colors.warn),

  /**
   * Log d'erreur
   * @param {string} message
   */
  error: (message) => log('error', message, colors.error),

  /**
   * Log de débogage
   * @param {string} message
   */
  debug: (message) => log('debug', message, colors.debug),
};
