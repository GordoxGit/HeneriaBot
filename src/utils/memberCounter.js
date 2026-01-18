/**
 * Utilitaire pour la gestion du compteur de membres dynamique
 * Gère la mise à jour du nom du salon vocal avec cooldown pour respecter les limites Discord
 */

const db = require('../database/db');
const logger = require('./logger');

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Met à jour le compteur de membres pour un serveur donné
 * @param {import('discord.js').Guild} guild - Le serveur Discord
 */
async function updateMemberCounter(guild) {
    try {
        // 1. Récupérer la configuration
        const config = db.get('SELECT * FROM counter_config WHERE guild_id = ?', [guild.id]);

        if (!config || !config.channel_id) {
            // Pas de configuration, on ne fait rien
            return;
        }

        // 2. Vérifier le cooldown
        const now = Date.now();
        const lastUpdate = config.last_update || 0;

        if (now - lastUpdate < COOLDOWN_MS) {
            logger.info(`⏳ Cooldown actif pour le compteur de ${guild.name} (Dernière MAJ: ${new Date(lastUpdate).toLocaleTimeString()})`);
            return;
        }

        // 3. Récupérer le salon
        const channel = guild.channels.cache.get(config.channel_id);
        if (!channel) {
            logger.error(`❌ Salon compteur introuvable pour ${guild.name} (ID: ${config.channel_id})`);
            return;
        }

        // 4. Formater le nom
        const memberCount = guild.memberCount;
        const format = config.format || '👥 Membres : {count}';
        const newName = format.replace('{count}', memberCount);

        // Vérifier si le nom est déjà correct pour éviter un appel API inutile
        if (channel.name === newName) {
            return;
        }

        // 5. Vérifier les permissions et mettre à jour le salon
        // Permission ManageChannels (Gestion des salons) requise
        if (!guild.members.me.permissionsIn(channel).has('ManageChannels')) {
             logger.error(`❌ Permission MANAGE_CHANNELS manquante pour le compteur de ${guild.name}`);
             return;
        }

        await channel.setName(newName);
        logger.info(`✅ Compteur mis à jour pour ${guild.name} : ${newName}`);

        // 6. Mettre à jour la date de dernière modification en BDD
        db.run('UPDATE counter_config SET last_update = ? WHERE guild_id = ?', [now, guild.id]);

    } catch (error) {
        logger.error(`❌ Erreur lors de la mise à jour du compteur pour ${guild.name} : ${error.message}`);
    }
}

module.exports = { updateMemberCounter };
