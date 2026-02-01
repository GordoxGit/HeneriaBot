/**
 * Utilitaires pour le système de niveaux
 */

/**
 * Calcule l'XP nécessaire pour compléter le niveau actuel et passer au suivant.
 * Formule : 5 * level^2 + 50 * level + 100
 * @param {number} level - Le niveau actuel
 * @returns {number} L'XP requise pour compléter ce niveau
 */
function getLevelThreshold(level) {
  return 5 * (level * level) + 50 * level + 100;
}

/**
 * Calcule le total d'XP requis pour atteindre un niveau donné (cumulatif).
 * @param {number} level - Le niveau cible
 * @returns {number} Le total d'XP requis depuis le niveau 0
 */
function getTotalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += getLevelThreshold(i);
  }
  return total;
}

/**
 * Calcule le niveau actuel et la progression basé sur l'XP total.
 * @param {number} totalXp - L'XP total de l'utilisateur
 * @returns {Object} Informations détaillées sur la progression
 * @property {number} level - Le niveau calculé
 * @property {number} currentLevelXp - L'XP acquis dans le niveau actuel
 * @property {number} xpToNextLevel - L'XP total requis pour compléter le niveau actuel
 * @property {number} progressPercent - Pourcentage de progression (0-100)
 * @property {number} remainingXp - XP manquant pour le prochain niveau
 */
function calculateLevelProgress(totalXp) {
  let level = 0;
  let accumulatedXp = 0;
  let threshold = getLevelThreshold(0);

  // Boucle tant que l'XP total couvre le seuil du niveau suivant
  while (totalXp >= accumulatedXp + threshold) {
    accumulatedXp += threshold;
    level++;
    threshold = getLevelThreshold(level);
  }

  const currentLevelXp = totalXp - accumulatedXp;
  const progressPercent = Math.min(100, Math.floor((currentLevelXp / threshold) * 100));

  return {
    level,
    currentLevelXp,
    xpToNextLevel: threshold,
    progressPercent,
    remainingXp: threshold - currentLevelXp
  };
}

module.exports = {
  getLevelThreshold,
  getTotalXpForLevel,
  calculateLevelProgress
};
