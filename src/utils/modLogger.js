const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { COLORS } = require('../config/constants');
const logger = require('./logger');

/**
 * Creates an infraction in the database.
 * @param {Object} guild - The Discord guild object.
 * @param {Object} targetUser - The user being sanctioned (User object).
 * @param {Object} moderator - The moderator performing the action (User object).
 * @param {string} type - The type of sanction (KICK, BAN, TEMPBAN, UNBAN, MUTE, WARN, UNMUTE, CLEARWARNS).
 * @param {string} reason - The reason for the sanction.
 * @param {number|null} duration - Duration in seconds (for tempbans/mutes), or null.
 * @returns {number|null} The ID of the created infraction, or null if failed.
 */
function createInfraction(guild, targetUser, moderator, type, reason, duration = null) {
  const timestamp = Math.floor(Date.now() / 1000);
  let expiresAt = null;

  if ((type === 'TEMPBAN' || type === 'MUTE') && duration) {
    expiresAt = timestamp + duration;
  }

  // Determine active state
  // KICK, UNBAN, UNMUTE, CLEARWARNS are instantaneous or removal actions, so not "active" punishments.
  let active = 1;
  if (['KICK', 'UNBAN', 'UNMUTE', 'CLEARWARNS'].includes(type)) {
      active = 0;
  }

  try {
    const result = db.run(
      `INSERT INTO infractions (guild_id, user_id, moderator_id, type, reason, created_at, expires_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [guild.id, targetUser.id, moderator.id, type, reason, timestamp, expiresAt, active]
    );
    return result.lastInsertRowid;
  } catch (err) {
    logger.error(`Failed to insert infraction into DB: ${err.message}`);
    return null;
  }
}

/**
 * Logs the action to the moderation channel.
 * @param {Object} guild - The Discord guild object.
 * @param {Object} targetUser - The user being sanctioned.
 * @param {Object} moderator - The moderator.
 * @param {string} type - The type of sanction.
 * @param {string} reason - The reason.
 * @param {number|null} duration - Duration in seconds.
 * @param {number|null} infractionId - The ID of the infraction from DB.
 */
async function logToModChannel(guild, targetUser, moderator, type, reason, duration = null, infractionId = null) {
  try {
    const setting = db.get('SELECT value FROM settings WHERE guild_id = ? AND key = ?', [guild.id, 'mod_log_channel']);

    if (setting && setting.value) {
      const logChannel = guild.channels.cache.get(setting.value);
      if (logChannel) {
        const timestamp = Math.floor(Date.now() / 1000);
        const expiresAt = duration ? timestamp + duration : null;

        const logEmbed = new EmbedBuilder()
          .setTitle(`Sanction : ${type}`)
          .setColor(getTypeColor(type))
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: 'Utilisateur', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: 'Modérateur', value: `${moderator.tag} (${moderator.id})`, inline: true },
            { name: 'Raison', value: reason || 'Aucune raison spécifiée' },
          )
          .setFooter({ text: `ID: ${infractionId || 'N/A'}` })
          .setTimestamp();

         if (duration && expiresAt) {
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
    case 'MUTE':
      return COLORS.ERROR;
    case 'KICK':
    case 'WARN':
      return COLORS.WARNING;
    case 'UNBAN':
    case 'UNMUTE':
    case 'CLEARWARNS':
      return COLORS.SUCCESS;
    default:
      return COLORS.INFO;
  }
}

// Keep logAction for backward compatibility if needed, but we should refactor everything.
// I will not export logAction to force me to refactor.

module.exports = { createInfraction, logToModChannel, getTypeColor };
