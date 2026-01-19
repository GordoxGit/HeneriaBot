/**
 * Authentifie les webhooks selon le site
 */
function authenticateWebhook(req, siteName) {
  const config = getWebhookConfig(siteName);

  switch (config.authMethod) {
    case 'token':
      // Certains sites envoient "Bearer token", d'autres juste le token
      // On gère les deux cas simplifiés ici, ou on suit la spec exacte du site
      // Ici on check si le header correspond exactement ou contient le token
      if (!req.headers.authorization) return false;
      return req.headers.authorization === `Bearer ${config.token}` || req.headers.authorization === config.token;

    case 'secret':
      return req.body.secret === config.secret;

    case 'ip': {
      const clientIp = req.ip || req.connection.remoteAddress;
      return config.allowedIps && config.allowedIps.includes(clientIp);
    }

    default:
      // Si aucune auth configurée pour le site, on refuse par sécurité
      // ou on accepte si authMethod est 'none' (pour dev/test)
      return config.authMethod === 'none';
  }
}

/**
 * Configuration des webhooks par site
 */
function getWebhookConfig(siteName) {
  const configs = {
    'hytale.game': {
      authMethod: 'token',
      token: process.env.VOTE_TOKEN_HYTALEGAME
    },
    'hytale-servs.fr': {
      authMethod: 'secret',
      secret: process.env.VOTE_SECRET_HYTALESERVS
    },
    'top-serveurs.net': {
      authMethod: 'token',
      token: process.env.VOTE_TOKEN_TOPSERVEURS
    },
    'serveur-prive.net': {
      authMethod: 'token',
      token: process.env.SERVEURPRIVE_TOKEN || process.env.VOTE_SECRET_SERVEURPRIVE
    }
  };

  return configs[siteName] || { authMethod: 'none' };
}

module.exports = {
  authenticateWebhook,
  getWebhookConfig
};
