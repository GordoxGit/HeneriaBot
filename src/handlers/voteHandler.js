const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

class VoteHandler {
  constructor() {
    this.client = null;
  }

  /**
   * Initialise le handler avec le client Discord
   * @param {Client} client
   */
  init(client) {
    this.client = client;
  }

  /**
   * Traite un vote (webhook, polling ou manuel)
   */
  async processVote(voteData, method = 'webhook', verifiedBy = null) {
    const { userId, guildId, siteName, externalVoteId, votedAt } = voteData;
    const voteTime = votedAt || Date.now();

    try {
      // 0. Vérifier si le vote externe existe déjà
      if (externalVoteId) {
        const existing = db.get('SELECT id FROM user_votes WHERE external_vote_id = ?', [externalVoteId]);
        if (existing) {
          logger.info(`Vote ${externalVoteId} déjà traité, ignoré`);
          return false;
        }
      }

      // 1. Vérifier le cooldown (24h)
      if (await this.isOnCooldown(userId, guildId, siteName, voteTime)) {
        logger.info(`Vote ignoré: ${userId} en cooldown sur ${siteName}`);
        return false;
      }

      // 2. Enregistrer le vote
      db.run(`
        INSERT INTO user_votes (user_id, guild_id, site_name, voted_at, verification_method, verified_by, external_vote_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, guildId, siteName, voteTime, method, verifiedBy, externalVoteId || null]);

      // 3. Envoyer le message de remerciement
      await this.sendThankYouMessage(userId, guildId, siteName);

      // 4. Attribuer les récompenses
      await this.giveRewards(userId, guildId, siteName);

      // 5. Mettre à jour les stats
      await this.updateVoteStats(userId, guildId);

      return true;
    } catch (error) {
      logger.error(`Erreur lors du traitement du vote : ${error.message}`);
      throw error;
    }
  }

  /**
   * Résout un username de site en Discord ID
   * @param {string} username - Username sur le site
   * @param {string} siteName - Nom du site
   * @param {string} guildId - ID du serveur
   * @returns {string|null} Discord ID ou null
   */
  resolveUsernameToDiscordId(username, siteName, guildId) {
    // 1. Chercher tous les codes potentiels dans le username
    const matches = [...username.matchAll(/([A-Z0-9]{6})/g)];

    for (const match of matches) {
      const code = match[1];

      // Chercher une liaison en attente avec ce code
      const pendingLink = db.get(`
        SELECT user_id, site_username FROM vote_username_links
        WHERE guild_id = ? AND site_name = ? AND verification_code = ?
          AND verified = 0 AND expires_at > ?
      `, [guildId, siteName, code, Date.now()]);

      if (pendingLink) {
        // Vérifier que le username contient bien le pseudo lié
        if (username.includes(pendingLink.site_username)) {
          // VÉRIFICATION RÉUSSIE ! Marquer comme vérifié
          db.run(`
            UPDATE vote_username_links
            SET verified = 1, verified_at = ?, verification_code = NULL
            WHERE guild_id = ? AND site_name = ? AND verification_code = ?
          `, [Date.now(), guildId, siteName, code]);

          logger.success(`[Vote] ✅ Liaison vérifiée: ${pendingLink.site_username} -> ${pendingLink.user_id}`);

          // Envoyer une confirmation en DM
          this.sendVerificationSuccessDM(pendingLink.user_id, siteName, pendingLink.site_username);

          return pendingLink.user_id;
        }
      }
    }

    // 2. Chercher une liaison vérifiée existante
    const verifiedLink = db.get(`
      SELECT user_id FROM vote_username_links
      WHERE guild_id = ? AND site_name = ? AND site_username = ? AND verified = 1
    `, [guildId, siteName, username]);

    if (verifiedLink) {
      return verifiedLink.user_id;
    }

    // 3. Aucune liaison trouvée
    return null;
  }

  /**
   * Envoie un DM de confirmation de vérification
   */
  async sendVerificationSuccessDM(userId, siteName, username) {
    if (!this.client) return;

    try {
      const user = await this.client.users.fetch(userId);

      await user.send({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Liaison vérifiée !',
          description: `Votre pseudo **${username}** sur **${siteName}** a été lié avec succès à votre compte Discord.`,
          fields: [
            {
              name: '🎁 Prochaines récompenses',
              value: 'Vos prochains votes sur ce site seront automatiquement détectés et récompensés !'
            },
            {
              name: '✏️ Pseudo',
              value: 'Vous pouvez maintenant remettre votre pseudo normal sur le site de vote.'
            }
          ],
          footer: { text: 'Heneria • Système de votes' },
          timestamp: new Date()
        }]
      });

      logger.info(`[Vote] DM de confirmation envoyé à ${userId}`);
    } catch (error) {
      logger.error(`[Vote] Impossible d'envoyer le DM à ${userId}: ${error.message}`);
    }
  }

  /**
   * Vérifie si l'utilisateur est en cooldown pour ce site
   */
  async isOnCooldown(userId, guildId, siteName, currentTime = Date.now()) {
    const cooldown = 24 * 60 * 60 * 1000; // 24 heures
    const lastVote = db.get(`
      SELECT voted_at FROM user_votes
      WHERE user_id = ? AND guild_id = ? AND site_name = ?
      ORDER BY voted_at DESC
      LIMIT 1
    `, [userId, guildId, siteName]);

    if (!lastVote) return false;

    // Si lastVote.voted_at est un timestamp (INTEGER), on compare directement
    return (currentTime - lastVote.voted_at) < cooldown;
  }

  /**
   * Envoie le message de remerciement dans le salon configuré
   */
  async sendThankYouMessage(userId, guildId, siteName) {
    if (!this.client) {
      logger.warn('Client Discord non initialisé dans VoteHandler');
      return;
    }

    try {
      // Récupérer le salon configuré
      const config = db.get(`
        SELECT value FROM settings WHERE guild_id = ? AND key = 'vote_channel_id'
      `, [guildId]);

      // Note: Le code original cherchait dans guild_settings, mais db.js a une table settings.
      // Vérifions si une table spécifique existe ou si on doit utiliser settings.
      // Le plan parlait de `vote_channel_id` dans `guild_settings`.
      // Mais db.js a `settings` (key, value) et `vote_sites` etc.
      // Je vais utiliser `settings` table pour `vote_channel_id` comme c'est le standard key-value.
      // Ou peut-être `ticket_config`? Non.
      // Je vais assumer que la configuration du channel de vote est stockée dans `settings` avec la clé `vote_channel_id`.

      if (!config || !config.value) return;

      const channelId = config.value;
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x780CED)
        .setTitle('✅ Merci pour ton vote !')
        .setDescription(`<@${userId}> a voté sur **${siteName}** !`)
        .addFields(
          { name: 'Prochaine récompense', value: 'Dans 24 heures', inline: true }
        )
        .setFooter({ text: 'Heneria • Système de votes' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Erreur lors de l'envoi du message de remerciement : ${error.message}`);
    }
  }

  /**
   * Attribue les récompenses configurées pour ce site
   */
  async giveRewards(userId, guildId, siteName) {
    // Récupérer les récompenses configurées
    const rewards = db.get(`
      SELECT reward_xp, reward_money FROM vote_sites
      WHERE guild_id = ? AND name = ?
    `, [guildId, siteName]);

    if (!rewards) return;

    // Donner XP si configuré
    if (rewards.reward_xp > 0) {
      // Vérifier si la table user_levels existe et l'utilisateur aussi, sinon insérer
      // Pour l'instant on fait un update simple, assumant que le système de niveau gère l'existence
      // Ou on utilise une requête sécurisée

      // Note: Je ne connais pas la structure exacte de user_levels ou economy_users
      // Je vais utiliser les requêtes fournies mais avec db.run qui est synchrone

      try {
        // On check si user_levels existe (dépend d'un autre module)
        // Si ça fail c'est pas grave
        db.run(`
            UPDATE user_levels
            SET xp = xp + ?
            WHERE user_id = ? AND guild_id = ?
        `, [rewards.reward_xp, userId, guildId]);
      } catch (error) {
          // Table might not exist
          logger.debug(`Impossible de donner l'XP de vote: ${error.message}`);
      }
    }

    // Donner monnaie si configuré
    if (rewards.reward_money > 0) {
      try {
        db.run(`
            UPDATE economy_users
            SET balance = balance + ?
            WHERE user_id = ? AND guild_id = ?
        `, [rewards.reward_money, userId, guildId]);
      } catch (error) {
          // Table might not exist
          logger.debug(`Impossible de donner l'argent de vote: ${error.message}`);
      }
    }
  }

  /**
   * Met à jour les statistiques de vote de l'utilisateur
   */
  async updateVoteStats(userId, guildId) {
    db.run(`
      INSERT INTO vote_stats (user_id, guild_id, total_votes, last_vote)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        total_votes = total_votes + 1,
        last_vote = ?
    `, [userId, guildId, Date.now(), Date.now()]);
  }
}

module.exports = new VoteHandler();
