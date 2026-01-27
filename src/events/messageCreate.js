/**
 * Événement MessageCreate
 * Gère l'attribution d'XP pour chaque message envoyé
 */

const { Events, EmbedBuilder } = require('discord.js');
const levelSystem = require('../utils/levelSystem');
const { COLORS } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  /**
   * Exécute l'événement
   * @param {import('discord.js').Message} message
   */
  async execute(message) {
    // Ignorer les bots et les messages systèmes
    if (message.author.bot || message.system) return;

    // Ignorer les messages en DM (pas de guilde)
    if (!message.guild) return;

    try {
      const userId = message.author.id;
      const guildId = message.guild.id;

      // Vérifier le cooldown (60 secondes)
      if (levelSystem.isOnCooldown(userId, guildId, 60)) {
        return; // L'utilisateur est en cooldown, pas d'XP
      }

      // Générer un montant aléatoire d'XP (15-25)
      const xpGained = levelSystem.getRandomXP();

      // Ajouter l'XP et vérifier le level up
      const result = levelSystem.addXP(userId, guildId, xpGained);

      // Si l'utilisateur a level up, envoyer une notification
      if (result.leveledUp) {
        const levelUpEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🎉 Level Up!')
          .setDescription(
            `Félicitations ${message.author.toString()} !\n` +
            `Tu viens d'atteindre le **niveau ${result.newLevel}** !`
          )
          .addFields(
            {
              name: '📊 XP Total',
              value: `${result.xp} XP`,
              inline: true
            },
            {
              name: '⏫ Prochain Niveau',
              value: `${levelSystem.getXPForNextLevel(result.newLevel)} XP`,
              inline: true
            }
          )
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `Ancien niveau: ${result.oldLevel}` });

        // Envoyer le message de level up dans le même salon
        await message.channel.send({ embeds: [levelUpEmbed] });

        logger.info(`[LevelUp] ${message.author.tag} (${userId}) a atteint le niveau ${result.newLevel} dans ${message.guild.name} (${guildId})`);
      }
    } catch (error) {
      logger.error(`[MessageCreate] Erreur lors de l'attribution d'XP : ${error.message}`);
      // On ne propage pas l'erreur pour ne pas interférer avec le traitement des messages
    }
  },
};
