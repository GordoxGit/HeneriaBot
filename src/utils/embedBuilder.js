/**
 * Utilitaire pour la création d'Embeds Discord standardisés pour Heneria
 */

const { EmbedBuilder } = require('discord.js');

// Configuration des couleurs
const COLORS = {
  MAIN: 0x780CED,      // Violet principal
  DARK: 0x1D0342,      // Bleu nuit
  LIGHT: 0xF2E1FF,     // Blanc rosé
  SUCCESS: 0x57F287,   // Vert (Standard Discord)
  ERROR: 0xED4245,     // Rouge (Standard Discord)
  WARNING: 0xFEE75C,   // Jaune (Standard Discord)
};

const FOOTER_TEXT = 'Heneria • Bot Discord';

/**
 * Crée un Embed de base avec la configuration par défaut
 * @returns {EmbedBuilder}
 */
function createEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.MAIN)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

module.exports = {
  createEmbed,

  /**
   * Crée un embed de succès
   * @param {string} description - Le message de succès
   * @returns {EmbedBuilder}
   */
  successEmbed: (description) => {
    return createEmbed()
      .setColor(COLORS.SUCCESS)
      .setDescription(`✅ | ${description}`);
  },

  /**
   * Crée un embed d'erreur
   * @param {string} description - Le message d'erreur
   * @returns {EmbedBuilder}
   */
  errorEmbed: (description) => {
    return createEmbed()
      .setColor(COLORS.ERROR)
      .setDescription(`❌ | ${description}`);
  },

  /**
   * Crée un embed d'avertissement
   * @param {string} description - Le message d'avertissement
   * @returns {EmbedBuilder}
   */
  warningEmbed: (description) => {
    return createEmbed()
      .setColor(COLORS.WARNING)
      .setDescription(`⚠️ | ${description}`);
  },

  /**
   * Crée un embed d'information
   * @param {string} description - Le message d'information
   * @returns {EmbedBuilder}
   */
  infoEmbed: (description) => {
    return createEmbed()
      .setColor(COLORS.MAIN)
      .setDescription(`ℹ️ | ${description}`);
  }
};
