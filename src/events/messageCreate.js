const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const levelSystem = require('../utils/levelSystem');
const { COLORS } = require('../config/constants');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorer les bots et les messages privés
    if (message.author.bot || !message.guild) return;

    try {
      const userId = message.author.id;
      const guildId = message.guild.id;
      const now = Math.floor(Date.now() / 1000);
      const COOLDOWN = 60; // 60 secondes

      // Récupérer les données utilisateur
      let userLevel = db.get(
        'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
        [userId, guildId]
      );

      // Si l'utilisateur n'existe pas, on l'initialise
      if (!userLevel) {
        db.run(
          'INSERT INTO user_levels (user_id, guild_id, xp, level, total_messages, last_message_timestamp) VALUES (?, ?, 0, 0, 0, 0)',
          [userId, guildId]
        );
        userLevel = {
          user_id: userId,
          guild_id: guildId,
          xp: 0,
          level: 0,
          total_messages: 0,
          last_message_timestamp: 0
        };
      }

      // Vérifier le cooldown
      if ((now - userLevel.last_message_timestamp) < COOLDOWN) {
        return;
      }

      // Calcul du gain d'XP (15 à 25)
      const xpGain = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
      const newXp = userLevel.xp + xpGain;
      const newTotalMessages = userLevel.total_messages + 1;

      // Calcul du nouveau niveau
      const progress = levelSystem.calculateLevelProgress(newXp);
      const newLevel = progress.level;
      const oldLevel = userLevel.level;

      // Mise à jour en base de données
      db.run(
        `UPDATE user_levels SET
         xp = ?,
         level = ?,
         total_messages = ?,
         last_message_timestamp = ?
         WHERE user_id = ? AND guild_id = ?`,
        [newXp, newLevel, newTotalMessages, now, userId, guildId]
      );

      // Notification de Level Up
      if (newLevel > oldLevel) {
        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🎉 Level Up !')
          .setDescription(`Félicitations ${message.author} ! Tu es passé au **Niveau ${newLevel}** !`)
          .setFooter({ text: 'Continue comme ça !' });

        try {
          await message.channel.send({ embeds: [embed] });
        } catch (error) {
          // Peut arriver si pas de permissions d'écriture
          logger.warn(`Impossible d'envoyer le message de Level Up dans ${message.channel.id}: ${error.message}`);
        }
      }

    } catch (error) {
      logger.error(`Erreur système XP (messageCreate): ${error.message}`);
    }
  },
};
