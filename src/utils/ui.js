module.exports = {
  /**
   * Génère une barre de progression textuelle
   * @param {number} current - Valeur actuelle
   * @param {number} max - Valeur maximale
   * @param {number} length - Longueur de la barre (en caractères)
   * @returns {string} Barre de progression formatée [███░░] 60%
   */
  getProgressBar: (current, max, length = 10) => {
    const percentage = Math.min(Math.max(current / max, 0), 1);
    const progress = Math.round(length * percentage);
    const emptyProgress = length - progress;
    const progressText = '█'.repeat(progress);
    const emptyProgressText = '░'.repeat(emptyProgress);
    const percentageText = Math.round(percentage * 100) + '%';
    return `[${progressText}${emptyProgressText}] ${percentageText}`;
  }
};
