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
        // Vérification des récompenses de rôle
        let rewardText = '';

        try {
          const reward = db.get(
            'SELECT role_id FROM level_rewards WHERE guild_id = ? AND level = ?',
            [guildId, newLevel]
          );

          if (reward) {
            try {
              // Récupération sécurisée du membre et du rôle
              const member = await message.guild.members.fetch(userId);
              const role = await message.guild.roles.fetch(reward.role_id);

              if (role && member) {
                await member.roles.add(role);
                rewardText = `\n\nBravo, tu gagnes le rôle ${role} !`;
                logger.info(`[INFO] Rôle ${role.name} donné à User ${member.user.tag}`);
              } else {
                logger.warn(`Rôle ou Membre introuvable pour la récompense (RoleID: ${reward.role_id})`);
              }
            } catch (error) {
              logger.error(`[ERROR] Impossible de donner le rôle (Permissions): ${error.message}`);
            }
          }
        } catch (dbError) {
          logger.error(`Erreur DB Level Reward: ${dbError.message}`);
        }

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🎉 Level Up !')
          .setDescription(`Félicitations ${message.author} ! Tu es passé au **Niveau ${newLevel}** !${rewardText}`)
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
