const express = require('express');
const router = express.Router();
const voteHandler = require('../handlers/voteHandler');
const { authenticateWebhook } = require('../utils/webhookAuth');
const logger = require('../utils/logger');

/**
 * Identifie le site de vote à partir de la requête
 * On s'attend à ce que l'URL configurée contienne ?site=nom_du_site
 * Ou on essaie de déduire du User-Agent ou du body si possible
 */
function identifySite(req) {
  if (req.query.site) {
    return req.query.site;
  }

  // Tentative de déduction basée sur le body (structure unique)
  // C'est risqué car ça dépend de l'ordre des checks
  if (req.body.discord_id && req.body.username && req.body.timestamp) {
    // Format hytale.game (exemple)
    return 'hytale.game';
  }

  if (req.body.user && req.body.user.discord && req.body.vote_time) {
    // Format hytale-servs.fr (exemple)
    return 'hytale-servs.fr';
  }

  // Fallback ou erreur
  return null;
}

/**
 * Parse les données de vote selon le format du site
 */
function parseVoteData(body, siteName) {
  // Chaque site envoie les données dans un format différent
  const parsers = {
    'hytale.game': (data) => ({
      userId: data.discord_id,
      username: data.username,
      siteName: 'hytale.game',
      // hytale.game peut envoyer un timestamp en ms ou secondes, à vérifier
      // Si timestamp absent, on utilise maintenant
      timestamp: data.timestamp || Date.now()
    }),
    'hytale-servs.fr': (data) => ({
      userId: data.user.discord,
      username: data.user.name,
      siteName: 'hytale-servs.fr',
      timestamp: data.vote_time ? new Date(data.vote_time).getTime() : Date.now()
    }),
    'top-serveurs.net': (data) => ({
        // Format hypothétique basé sur standards
        userId: data.playername || data.custom || data.discord_id,
        siteName: 'top-serveurs.net',
        timestamp: Date.now()
    }),
    'serveur-prive.net': (data) => ({
        userId: data.user_id || data.id_user || data.custom || data.discord_id,
        siteName: 'serveur-prive.net',
        timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now()
    })
  };

  const parser = parsers[siteName];
  if (!parser) {
    // Generic parser fallback if possible? No, safer to throw.
    throw new Error(`Unknown site parser for: ${siteName}`);
  }

  return parser(body);
}

/**
 * Validation basique des données
 */
function validateVoteData(data) {
    return data && data.userId && data.siteName;
}

// Endpoint webhook : POST /api/vote
// Idéalement appelé via /api/vote?site=nom_du_site
router.post('/vote', async (req, res) => {
  try {
    // 1. Identifier le site
    const site = identifySite(req);
    if (!site) {
        logger.warn('Webhook reçu sans identification de site');
        return res.status(400).json({ error: 'Site identification failed. Use ?site=name in URL.' });
    }

    // 2. Vérifier l'authentification
    if (!authenticateWebhook(req, site)) {
      logger.warn(`Authentification échouée pour le site ${site} (IP: ${req.ip})`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Extraire les données du vote
    let voteData;
    try {
        voteData = parseVoteData(req.body, site);
        // Ajout du guildId manquant (on assume que le bot gère une seule guilde ou que c'est dans config)
        // Les sites de vote n'envoient généralement pas le guildId sauf si configuré en custom data.
        // On utilise la guilde configurée par défaut dans config.js
        const config = require('../config');
        voteData.guildId = config.guildId;
    } catch (e) {
        logger.error(`Erreur parsing webhook (${site}): ${e.message}`);
        return res.status(400).json({ error: 'Invalid data format' });
    }

    // 4. Valider les données
    if (!validateVoteData(voteData)) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    // 5. Traiter le vote
    // On passe 'webhook' comme méthode
    await voteHandler.processVote(voteData, 'webhook');

    // 6. Répondre au site de vote
    res.status(200).json({ success: true });

  } catch (error) {
    logger.error('Vote webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
