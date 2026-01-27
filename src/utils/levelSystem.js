/**
 * Utilitaires pour le système de niveaux et d'XP
 * Contient les formules mathématiques et helpers pour la gamification
 */

const db = require('../database/db');

/**
 * Calcule l'XP requis pour atteindre un niveau donné
 * Formule : 5 * (niveau^2) + 50 * niveau + 100
 * @param {number} level - Le niveau cible
 * @returns {number} XP total requis pour ce niveau
 */
function getXPForLevel(level) {
  return 5 * Math.pow(level, 2) + 50 * level + 100;
}

/**
 * Calcule le niveau correspondant à une quantité d'XP
 * @param {number} xp - L'XP total de l'utilisateur
 * @returns {number} Le niveau actuel
 */
function getLevelFromXP(xp) {
  let level = 0;
  while (getXPForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

/**
 * Calcule l'XP requis pour passer au niveau suivant
 * @param {number} currentLevel - Le niveau actuel
 * @returns {number} XP requis pour le prochain niveau
 */
function getXPForNextLevel(currentLevel) {
  return getXPForLevel(currentLevel + 1);
}

/**
 * Calcule l'XP gagné de manière aléatoire (entre 15 et 25)
 * @returns {number} Montant d'XP gagné
 */
function getRandomXP() {
  return Math.floor(Math.random() * 11) + 15; // 15-25 XP
}

/**
 * Calcule la progression en pourcentage vers le niveau suivant
 * @param {number} currentXP - XP actuel
 * @param {number} currentLevel - Niveau actuel
 * @returns {Object} Objet avec les détails de progression
 */
function getProgressToNextLevel(currentXP, currentLevel) {
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);

  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;

  const percentage = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);

  return {
    currentXP: xpInCurrentLevel,
    requiredXP: xpNeededForNextLevel,
    percentage: Math.floor(percentage),
    nextLevelXP: nextLevelXP
  };
}

/**
 * Récupère ou crée les données de niveau d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} guildId - ID Discord de la guilde
 * @returns {Object} Données de niveau de l'utilisateur
 */
function getUserLevel(userId, guildId) {
  let user = db.get(
    'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  if (!user) {
    db.run(
      'INSERT INTO user_levels (user_id, guild_id, xp, level, total_messages, last_message_timestamp) VALUES (?, ?, 0, 0, 0, 0)',
      [userId, guildId]
    );
    user = {
      user_id: userId,
      guild_id: guildId,
      xp: 0,
      level: 0,
      total_messages: 0,
      last_message_timestamp: 0
    };
  }

  return user;
}

/**
 * Ajoute de l'XP à un utilisateur et vérifie s'il monte de niveau
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} guildId - ID Discord de la guilde
 * @param {number} xpGained - Montant d'XP gagné
 * @returns {Object} Résultat avec levelUp booléen et nouvelles données
 */
function addXP(userId, guildId, xpGained) {
  const user = getUserLevel(userId, guildId);
  const newXP = user.xp + xpGained;
  const newLevel = getLevelFromXP(newXP);
  const leveledUp = newLevel > user.level;

  db.run(
    'UPDATE user_levels SET xp = ?, level = ?, total_messages = total_messages + 1, last_message_timestamp = ? WHERE user_id = ? AND guild_id = ?',
    [newXP, newLevel, Date.now(), userId, guildId]
  );

  return {
    leveledUp,
    oldLevel: user.level,
    newLevel,
    xp: newXP,
    xpGained
  };
}

/**
 * Vérifie si l'utilisateur est en cooldown
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} guildId - ID Discord de la guilde
 * @param {number} cooldownSeconds - Durée du cooldown en secondes (défaut: 60)
 * @returns {boolean} True si en cooldown, false sinon
 */
function isOnCooldown(userId, guildId, cooldownSeconds = 60) {
  const user = getUserLevel(userId, guildId);
  const now = Date.now();
  const cooldownMs = cooldownSeconds * 1000;

  return (now - user.last_message_timestamp) < cooldownMs;
}

/**
 * Récupère le classement d'un utilisateur dans une guilde
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} guildId - ID Discord de la guilde
 * @returns {number} Rang de l'utilisateur (1 = premier)
 */
function getUserRank(userId, guildId) {
  const result = db.get(
    `SELECT COUNT(*) + 1 as rank
     FROM user_levels
     WHERE guild_id = ? AND xp > (
       SELECT xp FROM user_levels WHERE user_id = ? AND guild_id = ?
     )`,
    [guildId, userId, guildId]
  );

  return result ? result.rank : 1;
}

/**
 * Récupère le leaderboard d'une guilde
 * @param {string} guildId - ID Discord de la guilde
 * @param {number} limit - Nombre d'utilisateurs à retourner (défaut: 10)
 * @returns {Array} Liste des utilisateurs triés par XP
 */
function getLeaderboard(guildId, limit = 10) {
  return db.all(
    'SELECT * FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
    [guildId, limit]
  );
}

module.exports = {
  getXPForLevel,
  getLevelFromXP,
  getXPForNextLevel,
  getRandomXP,
  getProgressToNextLevel,
  getUserLevel,
  addXP,
  isOnCooldown,
  getUserRank,
  getLeaderboard
};
