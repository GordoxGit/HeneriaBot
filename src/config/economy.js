/**
 * Configuration du système économique
 */

module.exports = {
  // Symbole de la monnaie
  CURRENCY_SYMBOL: '🪙',

  // Nom de la monnaie
  CURRENCY_NAME: 'HeneriaCoins',

  // Taxe sur les transferts (0.05 = 5%)
  TRANSACTION_TAX: 0,

  // Récompense quotidienne par défaut
  DAILY_REWARD: 100,

  // Gain par message (min/max)
  MESSAGE_REWARD_MIN: 1,
  MESSAGE_REWARD_MAX: 5,

  // Cooldown pour le gain par message (en secondes)
  MESSAGE_COOLDOWN: 60
};
