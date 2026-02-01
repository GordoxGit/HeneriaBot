const db = require('../database/db');
const logger = require('../utils/logger');
const { logAction } = require('../utils/modLogger');

const CHECK_INTERVAL = 60 * 1000; // 60 seconds

function init(client) {
  logger.info('Initialisation du gestionnaire de modération...');

  // Run immediately on startup
  checkExpiredBans(client).catch(err => logger.error(`Erreur initiale checkExpiredBans: ${err.message}`));

  setInterval(async () => {
    try {
      await checkExpiredBans(client);
    } catch (error) {
      logger.error(`Erreur lors de la vérification des bans expirés : ${error.message}`);
    }
  }, CHECK_INTERVAL);
}

async function checkExpiredBans(client) {
  const now = Math.floor(Date.now() / 1000);

  // Find expired active tempbans
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
        // Mark as inactive anyway to stop processing
        db.run('UPDATE infractions SET active = 0 WHERE id = ?', [ban.id]);
        continue;
      }

      // Unban the user
      // We need to fetch the user object for logging, even if they are not in the guild (unban works with ID)
      let user;
      try {
        user = await client.users.fetch(ban.user_id);
      } catch (e) {
        logger.warn(`Utilisateur introuvable pour le ban ID ${ban.id} (User: ${ban.user_id}).`);
      }

      try {
        await guild.members.unban(ban.user_id, 'Expiration du bannissement temporaire');
        logger.success(`Utilisateur ${ban.user_id} débanni de ${guild.name} (Auto-Unban).`);

        // Log if we have the user object
        if (user) {
             // Pass client.user as moderator
             await logAction(guild, user, client.user, 'UNBAN', 'Expiration automatique du bannissement temporaire');
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
}

module.exports = { init };
