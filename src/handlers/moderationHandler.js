const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const logger = require('../utils/logger');
const { createInfraction, logToModChannel } = require('../utils/modLogger');
const { COLORS } = require('../config/constants');

const CHECK_INTERVAL = 60 * 1000; // 60 seconds

function init(client) {
  logger.info('Initialisation du gestionnaire de modération...');

  // Run immediately on startup
  checkExpiredInfractions(client).catch(err => logger.error(`Erreur initiale checkExpiredInfractions: ${err.message}`));

  setInterval(async () => {
    try {
      await checkExpiredInfractions(client);
    } catch (error) {
      logger.error(`Erreur lors de la vérification des infractions expirées : ${error.message}`);
    }
  }, CHECK_INTERVAL);
}

async function checkExpiredInfractions(client) {
  const now = Math.floor(Date.now() / 1000);

  // 1. Process Expired Mutes (Timeouts)
  try {
    const expiredMutes = db.all(
        `SELECT * FROM infractions
         WHERE type = 'MUTE' AND active = 1 AND expires_at <= ?`,
        [now]
    );

    for (const mute of expiredMutes) {
        const guild = client.guilds.cache.get(mute.guild_id);

        if (guild) {
             try {
                 // Try to notify the user
                 // Use member if possible (cleaner context), else fetch user
                 let target = await guild.members.fetch(mute.user_id).catch(() => null);
                 if (!target) {
                     target = await client.users.fetch(mute.user_id).catch(() => null);
                 }

                 if (target) {
                     const dmEmbed = new EmbedBuilder()
                        .setTitle('Sanction levée / Pardonnée')
                        .setDescription(`Votre mute temporaire est terminé sur **${guild.name}**.`)
                        .setColor(COLORS.SUCCESS);

                     await target.send({ embeds: [dmEmbed] }).catch(() => {
                         // Ignore DM errors (closed DMs, etc)
                     });
                 }
             } catch (err) {
                 logger.error(`Error processing mute expiry DM for ${mute.user_id}: ${err.message}`);
             }
        }

        // Mark as inactive in DB regardless of DM success
        db.run('UPDATE infractions SET active = 0 WHERE id = ?', [mute.id]);
    }
  } catch (err) {
    logger.error(`Erreur lors du traitement des mutes expirés : ${err.message}`);
  }

  // 2. Process Expired Tempbans
  try {
    const expiredBans = db.all(
        `SELECT * FROM infractions
         WHERE type = 'TEMPBAN' AND active = 1 AND expires_at <= ?`,
        [now]
    );

    if (expiredBans.length > 0) {
        logger.info(`${expiredBans.length} bannissement(s) temporaire(s) expiré(s) détecté(s).`);
    }

    for (const ban of expiredBans) {
        try {
            const guild = client.guilds.cache.get(ban.guild_id);
            if (!guild) {
                logger.warn(`Serveur introuvable pour le ban ID ${ban.id} (Guild: ${ban.guild_id}). Désactivation du ban.`);
                db.run('UPDATE infractions SET active = 0 WHERE id = ?', [ban.id]);
                continue;
            }

            let user;
            try {
                user = await client.users.fetch(ban.user_id);
            } catch (e) {
                logger.warn(`Utilisateur introuvable pour le ban ID ${ban.id} (User: ${ban.user_id}).`);
            }

            try {
                await guild.members.unban(ban.user_id, 'Unban automatique');
                logger.success(`Unban automatique de ${ban.user_id}`);

                if (user) {
                    const reason = 'Unban automatique (Expiration Tempban)';
                    const infractionId = createInfraction(guild, user, client.user, 'UNBAN', reason);
                    await logToModChannel(guild, user, client.user, 'UNBAN', reason, null, infractionId);

                    // Send DM
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('Sanction levée / Pardonnée')
                        .setDescription(`Votre bannissement temporaire est terminé sur **${guild.name}**.`)
                        .setColor(COLORS.SUCCESS);
                    await user.send({ embeds: [dmEmbed] }).catch(() => {});
                }

            } catch (err) {
                // If error is "Unknown Ban", it means they were already unbanned manually
                if (err.code === 10026) {
                   logger.info(`L'utilisateur ${ban.user_id} n'était plus banni sur ${guild.name}.`);
                } else {
                   logger.error(`Impossible de débannir ${ban.user_id} sur ${guild.name} : ${err.message}`);
                   // If permission error or other temporary error, we skip updating DB so it retries next time
                   if (err.code !== 10026) continue;
                }
            }

            // Mark as inactive (successfully unbanned or was already unbanned)
            db.run('UPDATE infractions SET active = 0 WHERE id = ?', [ban.id]);

        } catch (err) {
            logger.error(`Erreur lors du traitement du ban ID ${ban.id} : ${err.message}`);
        }
    }
  } catch (err) {
      logger.error(`Erreur lors du traitement des bans expirés: ${err.message}`);
  }
}

module.exports = { init };
