const express = require('express');
const router = express.Router();
const voteHandler = require('../../handlers/voteHandler');
const logger = require('../../utils/logger');
const crypto = require('crypto');

// Middleware de vérification signature (si fournie par le site)
const verifySignature = (secret) => (req, res, next) => {
    if (!secret) return next();

    const signature = req.headers['x-signature'] || req.headers['x-hub-signature'];
    if (!signature) return next();

    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (signature !== `sha256=${expectedSig}`) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
};

// Endpoint pour hytale.game
router.post('/hytale-game/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        await voteHandler.handleWebhook(req.body, guildId, 'hytale-game');
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(`[Webhook] Erreur hytale-game: ${error.message}`);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Endpoint pour top-serveurs.net
router.post('/top-serveurs/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        await voteHandler.handleWebhook(req.body, guildId, 'top-serveurs');
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(`[Webhook] Erreur top-serveurs: ${error.message}`);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Endpoint pour hytale-servs.fr (si webhook supporté)
router.post('/hytale-servs/:guildId', async (req, res) => {
    try {
        const { guildId } = req.params;
        await voteHandler.handleWebhook(req.body, guildId, 'hytale-servs');
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error(`[Webhook] Erreur hytale-servs: ${error.message}`);
        res.status(500).json({ error: 'Internal error' });
    }
});

module.exports = router;
