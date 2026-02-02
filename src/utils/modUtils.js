const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const logger = require('./logger');

/**
 * Sends a standardized moderation DM to a user.
 * @param {Object} user - The Discord User object.
 * @param {Object} guild - The Discord Guild object.
 * @param {string} type - The type of sanction (e.g., 'BAN', 'KICK', 'MUTE', 'WARN').
 * @param {string} reason - The reason for the sanction.
 * @param {string} [duration] - The duration string or timestamp (optional).
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendModerationDM(user, guild, type, reason, duration = null) {
  try {
    const color = (type === 'WARN' || type === 'KICK') ? COLORS.WARNING : COLORS.ERROR;

    const embed = new EmbedBuilder()
      .setTitle(`Sanction : ${type}`)
      .setColor(color)
      .setDescription(`Vous avez reçu une sanction sur **${guild.name}**.`)
      .addFields({ name: 'Raison', value: reason || 'Aucune raison spécifiée' })
      .setTimestamp();

    if (duration) {
      embed.addFields({ name: 'Durée', value: duration });
    }

    await user.send({ embeds: [embed] });
    return { sent: true, error: null };
  } catch (error) {
    // 50007: Cannot send messages to this user
    if (error.code === 50007) {
      logger.warn(`Could not DM user ${user.tag} (50007 - DMs closed)`);
      return { sent: false, error: 'MP impossible : utilisateur fermé' };
    }

    logger.warn(`Could not DM user ${user.tag}: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

/**
 * Sends a standardized sanction ended DM to a user.
 * @param {Object} user - The Discord User object.
 * @param {Object} guild - The Discord Guild object.
 * @param {string} type - The type of sanction ended (e.g., 'BAN', 'MUTE', 'TEMPBAN').
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendSanctionEndedDM(user, guild, type) {
  try {
    let description = `Votre sanction est terminée sur **${guild.name}**.`;
    if (type === 'MUTE' || type === 'TIMEOUT') {
      description = `Votre réduction au silence est terminée sur **${guild.name}**.`;
    } else if (type === 'BAN' || type === 'TEMPBAN') {
      description = `Votre bannissement est terminé sur **${guild.name}**.`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Sanction levée / Pardonnée')
      .setColor(COLORS.SUCCESS)
      .setDescription(description)
      .setTimestamp();

    await user.send({ embeds: [embed] });
    return { sent: true, error: null };
  } catch (error) {
    if (error.code === 50007) {
      return { sent: false, error: 'MP impossible : utilisateur fermé' };
    }
    return { sent: false, error: error.message };
  }
}

module.exports = { sendModerationDM, sendSanctionEndedDM };
