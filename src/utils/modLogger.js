const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { COLORS } = require('../config/constants');
const logger = require('./logger');

/**
 * Logs a moderation action.
 * @param {Object} guild - The Discord guild object.
 * @param {Object} targetUser - The user being sanctioned (User object).
 * @param {Object} moderator - The moderator performing the action (User object).
 * @param {string} type - The type of sanction (KICK, BAN, TEMPBAN, UNBAN).
 * @param {string} reason - The reason for the sanction.
 * @param {number|null} duration - Duration in seconds (for tempbans), or null.
 */
async function logAction(guild, targetUser, moderator, type, reason, duration = null) {
  const timestamp = Math.floor(Date.now() / 1000);
  let expiresAt = null;

  if (type === 'TEMPBAN' && duration) {
    expiresAt = timestamp + duration;
  }

  // 1. Insert into Database
  try {
    db.run(
      `INSERT INTO infractions (guild_id, user_id, moderator_id, type, reason, created_at, expires_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [guild.id, targetUser.id, moderator.id, type, reason, timestamp, expiresAt, 1]
    );
  } catch (err) {
    logger.error(`Failed to insert infraction into DB: ${err.message}`);
  }

  // 2. DM the User (Best effort)
  // Only DM if it's not an UNBAN (usually unbans don't need DMs, but prompt said "Tenter d'envoyer un message privé à l'utilisateur avant d'appliquer la sanction")
  // For UNBAN, user might not share server anymore so DM might fail, but we try if we can.
  // Actually, for KICK/BAN/TEMPBAN we should definitely try.

  if (type !== 'UNBAN') {
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`Sanction : ${type}`)
        .setColor(COLORS.ERROR)
        .setDescription(`Vous avez reçu une sanction sur **${guild.name}**.`)
        .addFields(
          { name: 'Raison', value: reason || 'Aucune raison spécifiée' },
          { name: 'Modérateur', value: moderator.tag }
        )
        .setTimestamp();

      if (duration) {
        dmEmbed.addFields({ name: 'Durée', value: `<t:${expiresAt}:R>` });
      }

      await targetUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      logger.warn(`Could not DM user ${targetUser.tag}: ${err.message}`);
    }
  }

  // 3. Log to Channel
  try {
    const setting = db.get('SELECT value FROM settings WHERE guild_id = ? AND key = ?', [guild.id, 'mod_log_channel']);

    if (setting && setting.value) {
      const logChannel = guild.channels.cache.get(setting.value);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`Sanction : ${type}`)
          .setColor(getTypeColor(type))
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: 'Utilisateur', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'Modérateur', value: `${moderator.tag} (${moderator.id})`, inline: true },
            { name: 'Raison', value: reason || 'Aucune raison spécifiée' },
          )
          .setTimestamp();

         if (duration) {
            logEmbed.addFields({ name: 'Expiration', value: `<t:${expiresAt}:F> (<t:${expiresAt}:R>)` });
         }

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (err) {
    logger.error(`Failed to send log to channel: ${err.message}`);
  }
}

function getTypeColor(type) {
  switch (type) {
    case 'BAN':
    case 'TEMPBAN':
      return COLORS.ERROR;
    case 'KICK':
      return COLORS.WARNING;
    case 'UNBAN':
      return COLORS.SUCCESS;
    default:
      return COLORS.INFO;
  }
}

module.exports = { logAction };
