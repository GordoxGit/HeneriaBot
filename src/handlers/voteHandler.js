const db = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const fetch = require('node-fetch');
const { COLORS } = require('../config/constants');

class VoteHandler {
    constructor() {
        this.client = null;
        this.pollingIntervals = new Map();
    }

    /**
     * Initialise le handler avec le client Discord
     */
    init(client) {
        this.client = client;
        try {
            this.startPolling();
        } catch (error) {
            logger.error(`[VoteHandler] Erreur lors du démarrage du polling: ${error.message}`);
        }
        logger.success('[VoteHandler] Initialisé');
    }

    /**
     * Démarre le polling pour tous les sites configurés
     */
    startPolling() {
        // Nettoyer les anciens intervals
        this.pollingIntervals.forEach(interval => clearInterval(interval));
        this.pollingIntervals.clear();

        // Récupérer tous les guilds avec des sites de polling
        const sites = db.all(`
            SELECT DISTINCT guild_id, slug, api_type, api_base_url, api_token
            FROM vote_sites
            WHERE api_type IN ('polling_otp', 'polling_check') AND enabled = 1
        `);

        for (const site of sites) {
            const key = `${site.guild_id}-${site.slug}`;

            // Polling toutes les 2 minutes
            const interval = setInterval(() => {
                this.pollSite(site).catch(err =>
                    logger.error(`[VoteHandler] Erreur polling ${site.slug}: ${err.message}`)
                );
            }, 2 * 60 * 1000);

            this.pollingIntervals.set(key, interval);

            // Premier check immédiat
            this.pollSite(site).catch(() => {});
        }

        logger.info(`[VoteHandler] Polling démarré pour ${sites.length} sites`);
    }

    /**
     * Poll un site spécifique
     */
    async pollSite(site) {
        if (site.api_type === 'polling_otp') {
            await this.pollOTPSite(site);
        } else if (site.api_type === 'polling_check') {
            await this.pollCheckSite(site);
        }
    }

    /**
     * Poll sites avec système OTP (serveur-prive.net)
     */
    async pollOTPSite(site) {
        // Récupérer les sessions OTP en attente
        const sessions = db.all(`
            SELECT * FROM vote_otp_sessions
            WHERE guild_id = ? AND site_slug = ? AND used = 0 AND expires_at > ?
        `, [site.guild_id, site.slug, Math.floor(Date.now() / 1000)]);

        for (const session of sessions) {
            try {
                const response = await fetch(
                    `${site.api_base_url}/votes/${session.otp_token}`,
                    { headers: { 'Accept': 'application/json' } }
                );

                const data = await response.json();

                if (data.success) {
                    // Vote détecté !
                    await this.processVote({
                        userId: session.user_id,
                        guildId: site.guild_id,
                        siteSlug: site.slug,
                        externalVoteId: `otp-${session.otp_token}`,
                        votedAt: data.data.voted_at * 1000,
                        method: 'otp'
                    });

                    // Marquer la session comme utilisée
                    db.run(`
                        UPDATE vote_otp_sessions SET used = 1 WHERE id = ?
                    `, [session.id]);
                }
            } catch (error) {
                // Erreur silencieuse, le vote n'a pas encore eu lieu
            }
        }
    }

    /**
     * Poll sites avec système check (hytale-servs.fr, top-serveurs.net)
     */
    async pollCheckSite(site) {
        // Récupérer les utilisateurs qui ont utilisé /vote récemment
        const recentUsers = db.all(`
            SELECT DISTINCT user_id FROM vote_otp_sessions
            WHERE guild_id = ? AND site_slug = ?
            AND created_at > ? AND used = 0
        `, [site.guild_id, site.slug, Math.floor(Date.now() / 1000) - 3600]);

        for (const { user_id } of recentUsers) {
            try {
                // Top-Serveurs utilise une API différente
                if (site.slug === 'top-serveurs') {
                    await this.pollTopServeurs(site, user_id);
                } else {
                    // Hytale-Servs et autres sites compatibles
                    await this.pollHytaleServs(site, user_id);
                }
            } catch (error) {
                logger.debug(`[VoteHandler] Check échoué pour ${user_id}: ${error.message}`);
            }
        }
    }

    /**
     * Poll Top-Serveurs avec vérification par username
     */
    async pollTopServeurs(site, userId) {
        if (!this.client) {
            logger.warn('[VoteHandler] Client Discord non disponible pour Top-Serveurs');
            return;
        }

        try {
            // Récupérer l'utilisateur Discord pour obtenir son username
            const user = await this.client.users.fetch(userId);
            if (!user) {
                logger.warn(`[VoteHandler] Utilisateur ${userId} introuvable`);
                return;
            }

            // Construire l'URL de l'API Top-Serveurs
            // Format: https://api.top-serveurs.net/v1/servers/{token}/votes/check?username={username}
            const baseUrl = site.api_base_url || 'https://api.top-serveurs.net';
            const apiUrl = `${baseUrl}/v1/servers/${site.api_token}/votes/check?username=${encodeURIComponent(user.username)}`;

            const response = await fetch(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                logger.debug(`[VoteHandler] Top-Serveurs API erreur ${response.status} pour ${user.username}`);
                return;
            }

            const data = await response.json();

            // Top-Serveurs retourne { success: true, hasVoted: true, voteId: "..." }
            if (data.success && data.hasVoted) {
                // Vote détecté !
                await this.processVote({
                    userId: userId,
                    guildId: site.guild_id,
                    siteSlug: site.slug,
                    externalVoteId: `top-serveurs-${data.voteId || Date.now()}`,
                    votedAt: data.votedAt ? new Date(data.votedAt).getTime() : Date.now(),
                    method: 'polling'
                });

                logger.success(`[VoteHandler] Vote Top-Serveurs détecté pour ${user.username}`);
            }
        } catch (error) {
            logger.debug(`[VoteHandler] Erreur Top-Serveurs pour ${userId}: ${error.message}`);
        }
    }

    /**
     * Poll Hytale-Servs avec vérification par externalId
     */
    async pollHytaleServs(site, userId) {
        const response = await fetch(
            `${site.api_base_url}/vote-check?api_key=${site.api_token}&externalId=${userId}`,
            { headers: { 'Accept': 'application/json' } }
        );

        const data = await response.json();

        if (data.ok && data.canClaim) {
            // Vote détecté et peut être claim
            await this.processVote({
                userId: userId,
                guildId: site.guild_id,
                siteSlug: site.slug,
                externalVoteId: `${site.slug}-${data.vote.id}`,
                votedAt: new Date(data.vote.votedAt).getTime(),
                method: 'polling'
            });

            // Claim le vote
            await fetch(`${site.api_base_url}/vote-claim?api_key=${site.api_token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ externalId: userId })
            });
        }
    }

    /**
     * Génère un OTP pour serveur-prive.net
     */
    async generateOTP(userId, guildId, siteSlug) {
        const site = db.get(`
            SELECT * FROM vote_sites WHERE guild_id = ? AND slug = ?
        `, [guildId, siteSlug]);

        if (!site || !site.api_base_url || !site.api_token) {
            return null;
        }

        try {
            const response = await fetch(
                `${site.api_base_url}/otp`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${site.api_token}`
                    }
                }
            );

            const data = await response.json();

            if (data.success && data.data.token) {
                // Sauvegarder la session OTP
                db.run(`
                    INSERT INTO vote_otp_sessions (user_id, guild_id, site_slug, otp_token, expires_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [userId, guildId, siteSlug, data.data.token, Math.floor(Date.now() / 1000) + 300]);

                return data.data.token;
            }
        } catch (error) {
            logger.error(`[VoteHandler] Erreur génération OTP: ${error.message}`);
        }

        return null;
    }

    /**
     * Traite un vote détecté
     */
    async processVote({ userId, guildId, siteSlug, externalVoteId, votedAt, method }) {
        const voteTime = votedAt || Date.now();

        try {
            // Vérifier si ce vote a déjà été traité
            if (externalVoteId) {
                const existing = db.get(
                    'SELECT id FROM user_votes WHERE external_vote_id = ?',
                    [externalVoteId]
                );

                if (existing) {
                    logger.debug(`[VoteHandler] Vote ${externalVoteId} déjà traité`);
                    return false;
                }
            }

            // Récupérer le site
            const site = db.get(
                'SELECT * FROM vote_sites WHERE guild_id = ? AND slug = ?',
                [guildId, siteSlug]
            );

            if (!site) {
                logger.warn(`[VoteHandler] Site ${siteSlug} introuvable pour guild ${guildId}`);
                return false;
            }

            // Vérifier le cooldown
            if (await this.isOnCooldown(userId, guildId, siteSlug, voteTime)) {
                logger.info(`[VoteHandler] Vote ignoré: ${userId} en cooldown sur ${siteSlug}`);
                return false;
            }

            // Enregistrer le vote
            db.run(`
                INSERT INTO user_votes (user_id, guild_id, site_slug, voted_at, external_vote_id, verification_method, rewards_given)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `, [userId, guildId, siteSlug, Math.floor(voteTime / 1000), externalVoteId, method]);

            // Attribuer les récompenses
            await this.giveRewards(userId, guildId, site);

            // Mettre à jour les stats
            await this.updateVoteStats(userId, guildId);

            // Envoyer le message de remerciement
            await this.sendThankYouMessage(userId, guildId, site);

            logger.success(`[VoteHandler] Vote traité: ${userId} sur ${siteSlug}`);
            return true;

        } catch (error) {
            logger.error(`[VoteHandler] Erreur processVote: ${error.message}`);
            return false;
        }
    }

    /**
     * Vérifie le cooldown d'un utilisateur sur un site
     */
    async isOnCooldown(userId, guildId, siteSlug, currentTime = Date.now()) {
        const site = db.get(
            'SELECT cooldown_hours FROM vote_sites WHERE guild_id = ? AND slug = ?',
            [guildId, siteSlug]
        );

        const cooldownMs = (site?.cooldown_hours || 24) * 60 * 60 * 1000;

        const lastVote = db.get(`
            SELECT voted_at FROM user_votes
            WHERE user_id = ? AND guild_id = ? AND site_slug = ?
            ORDER BY voted_at DESC LIMIT 1
        `, [userId, guildId, siteSlug]);

        if (!lastVote) return false;

        return (currentTime - lastVote.voted_at * 1000) < cooldownMs;
    }

    /**
     * Récupère les cooldowns de l'utilisateur pour tous les sites
     */
    async getUserCooldowns(userId, guildId) {
        const sites = db.all(
            'SELECT slug, cooldown_hours FROM vote_sites WHERE guild_id = ? AND enabled = 1',
            [guildId]
        );

        const cooldowns = {};
        const now = Date.now();

        for (const site of sites) {
            const lastVote = db.get(`
                SELECT voted_at FROM user_votes
                WHERE user_id = ? AND guild_id = ? AND site_slug = ?
                ORDER BY voted_at DESC LIMIT 1
            `, [userId, guildId, site.slug]);

            if (!lastVote) {
                cooldowns[site.slug] = { canVote: true };
            } else {
                const cooldownMs = (site.cooldown_hours || 24) * 60 * 60 * 1000;
                const nextVoteAt = lastVote.voted_at * 1000 + cooldownMs;

                cooldowns[site.slug] = {
                    canVote: now >= nextVoteAt,
                    nextVoteAt: Math.floor(nextVoteAt / 1000)
                };
            }
        }

        return cooldowns;
    }

    /**
     * Attribue les récompenses au voteur
     */
    async giveRewards(userId, guildId, site) {
        // XP
        if (site.reward_xp > 0) {
            try {
                db.run(`
                    INSERT INTO user_levels (user_id, guild_id, xp, level, total_messages)
                    VALUES (?, ?, ?, 0, 0)
                    ON CONFLICT(user_id, guild_id) DO UPDATE SET xp = xp + ?
                `, [userId, guildId, site.reward_xp, site.reward_xp]);
            } catch (error) {
                logger.debug(`[VoteHandler] Table user_levels non disponible: ${error.message}`);
            }
        }

        // Monnaie
        if (site.reward_money > 0) {
            try {
                db.run(`
                    INSERT INTO economy_users (user_id, guild_id, balance)
                    VALUES (?, ?, ?)
                    ON CONFLICT(user_id, guild_id) DO UPDATE SET balance = balance + ?
                `, [userId, guildId, site.reward_money, site.reward_money]);
            } catch (error) {
                logger.debug(`[VoteHandler] Table economy_users non disponible: ${error.message}`);
            }
        }
    }

    /**
     * Met à jour les statistiques de vote
     */
    async updateVoteStats(userId, guildId) {
        const now = Math.floor(Date.now() / 1000);

        // Récupérer ou créer les stats
        let stats = db.get(
            'SELECT * FROM vote_stats WHERE user_id = ? AND guild_id = ?',
            [userId, guildId]
        );

        if (!stats) {
            db.run(`
                INSERT INTO vote_stats (user_id, guild_id, total_votes, monthly_votes, current_streak, best_streak, last_vote_at)
                VALUES (?, ?, 1, 1, 1, 1, ?)
            `, [userId, guildId, now]);
            return;
        }

        // Calculer le streak
        const oneDayAgo = now - 86400;
        const twoDaysAgo = now - 172800;
        let newStreak = stats.current_streak;

        if (stats.last_vote_at >= oneDayAgo) {
            // Déjà voté aujourd'hui, pas de changement de streak
        } else if (stats.last_vote_at >= twoDaysAgo) {
            // Voté hier, streak continue
            newStreak = stats.current_streak + 1;
        } else {
            // Plus de 2 jours, streak reset
            newStreak = 1;
        }

        const bestStreak = Math.max(newStreak, stats.best_streak);

        // Reset mensuel
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthStart = Math.floor(startOfMonth.getTime() / 1000);

        const monthlyVotes = stats.last_month_reset < monthStart
            ? 1
            : stats.monthly_votes + 1;

        db.run(`
            UPDATE vote_stats SET
                total_votes = total_votes + 1,
                monthly_votes = ?,
                current_streak = ?,
                best_streak = ?,
                last_vote_at = ?,
                last_month_reset = ?
            WHERE user_id = ? AND guild_id = ?
        `, [monthlyVotes, newStreak, bestStreak, now, monthStart, userId, guildId]);
    }

    /**
     * Envoie le message de remerciement
     */
    async sendThankYouMessage(userId, guildId, site) {
        if (!this.client) return;

        try {
            // Récupérer le salon configuré
            const config = db.get(`
                SELECT value FROM settings WHERE guild_id = ? AND key = 'vote_channel_id'
            `, [guildId]);

            if (!config?.value) return;

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(config.value);
            if (!channel) return;

            // Récupérer les stats de l'utilisateur
            const stats = db.get(
                'SELECT * FROM vote_stats WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('✅ Merci pour ton vote !')
                .setDescription(`<@${userId}> a voté sur **${site.name}** !`)
                .addFields(
                    { name: '🎁 Récompenses', value: `+${site.reward_xp} XP\n+${site.reward_money} 💰`, inline: true },
                    { name: '🔥 Streak', value: `${stats?.current_streak || 1} jour(s)`, inline: true },
                    { name: '📊 Total', value: `${stats?.total_votes || 1} votes`, inline: true }
                )
                .setFooter({ text: 'Heneria • Système de votes' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

        } catch (error) {
            logger.error(`[VoteHandler] Erreur envoi message: ${error.message}`);
        }
    }

    /**
     * Traite un webhook de vote entrant
     */
    async handleWebhook(webhookData, guildId, siteSlug) {
        // À implémenter selon le format du webhook reçu
        // Cette fonction sera appelée par un endpoint Express ou un listener de message

        const { username, discordId, voteId } = this.parseWebhookData(webhookData, siteSlug);

        if (!username && !discordId) {
            logger.warn(`[VoteHandler] Webhook invalide pour ${siteSlug}`);
            return false;
        }

        // Si on a un Discord ID directement
        if (discordId) {
            return this.processVote({
                userId: discordId,
                guildId,
                siteSlug,
                externalVoteId: voteId || `webhook-${Date.now()}`,
                votedAt: Date.now(),
                method: 'webhook'
            });
        }

        // Sinon, essayer de résoudre le username
        // Ici tu pourrais implémenter une logique de matching pseudo -> Discord ID
        logger.warn(`[VoteHandler] Username non résolu: ${username}`);
        return false;
    }

    /**
     * Parse les données webhook selon le site
     */
    parseWebhookData(data, siteSlug) {
        // Format peut varier selon le site
        // À adapter selon les webhooks réels reçus

        if (siteSlug === 'hytale-game' || siteSlug === 'top-serveurs') {
            // Ces sites envoient généralement un embed avec le pseudo
            if (data.embeds && data.embeds[0]) {
                const embed = data.embeds[0];
                // Parser le pseudo depuis la description ou les fields
                const match = embed.description?.match(/(\w+) a voté/i);
                return { username: match?.[1] };
            }
        }

        return {};
    }

    /**
     * Recharge le polling (après ajout/suppression de sites)
     */
    reloadPolling() {
        this.startPolling();
    }
}

module.exports = new VoteHandler();
