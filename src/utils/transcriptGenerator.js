/**
 * Générateur de transcript HTML
 * Génère un fichier HTML contenant l'historique des messages d'un ticket
 */

const { AttachmentBuilder } = require('discord.js');
const logger = require('./logger');

/**
 * Échappe les caractères HTML spéciaux pour éviter les failles XSS
 * @param {string} text - Le texte à échapper
 * @returns {string} - Le texte échappé
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Génère un transcript HTML pour un ticket
 * @param {import('discord.js').TextChannel} channel - Le salon du ticket
 * @param {Object} ticket - Les données du ticket en BDD
 * @param {import('discord.js').Guild} guild - Le serveur
 * @returns {Promise<Buffer>} - Le buffer du fichier HTML
 */
async function generateTranscript(channel, ticket, guild) {
  try {
    // Récupération des messages (limite 500 comme demandé)
    let messages = [];
    let lastId;

    while (messages.length < 500) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const fetched = await channel.messages.fetch(options);
      if (fetched.size === 0) break;

      messages.push(...fetched.values());
      lastId = fetched.last().id;

      if (fetched.size < 100) break;
    }

    // Les messages sont dans l'ordre inverse (plus récent au plus vieux), on les remet dans l'ordre chrono
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Récupération des infos complémentaires
    const creator = await guild.members.fetch(ticket.user_id).catch(() => null);
    const staff = ticket.staff_id ? await guild.members.fetch(ticket.staff_id).catch(() => null) : null;

    // Formatage des dates
    const formatDate = (date) => new Date(date).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const createdAt = formatDate(ticket.created_at);
    const closedAt = formatDate(new Date());

    // Génération du HTML
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transcript - Ticket #${escapeHtml(ticket.id)}</title>
    <style>
        body {
            background: #1D0342;
            color: #F2E1FF;
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #780CED, #1D0342);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        h1 { margin-top: 0; color: #fff; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        .info-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
            border-radius: 5px;
        }
        .message {
            background: #2a1a4a;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #780CED;
            border-radius: 5px;
            display: flex;
            align-items: flex-start;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 15px;
            flex-shrink: 0;
        }
        .message-content {
            flex-grow: 1;
            min-width: 0; /* Pour que le text-wrap fonctionne */
        }
        .message-header {
            margin-bottom: 5px;
        }
        .author {
            color: #780CED;
            font-weight: bold;
            margin-right: 10px;
        }
        .timestamp {
            color: #999;
            font-size: 0.85em;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.4;
        }
        .attachment {
            margin-top: 10px;
            display: block;
            color: #780CED;
            text-decoration: none;
            background: rgba(120, 12, 237, 0.1);
            padding: 5px 10px;
            border-radius: 5px;
            width: fit-content;
        }
        .attachment img {
            max-width: 300px;
            max-height: 300px;
            border-radius: 5px;
            margin-top: 5px;
            display: block;
        }
        .embed {
            margin-top: 10px;
            border-left: 4px solid #4f545c;
            background: rgba(0, 0, 0, 0.2);
            padding: 10px;
            border-radius: 4px;
        }
        .embed-title { font-weight: bold; margin-bottom: 5px; }
        .embed-desc { font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎫 Transcript - Ticket #${escapeHtml(ticket.id.toString().padStart(4, '0'))}</h1>
        <div class="info-grid">
            <div class="info-item">📝 Type: ${escapeHtml(ticket.category || 'Inconnu')}</div>
            <div class="info-item">👤 Créé par: ${escapeHtml(creator ? creator.user.tag : 'Inconnu')}</div>
            <div class="info-item">📅 Créé le: ${createdAt}</div>
            <div class="info-item">🔒 Fermé le: ${closedAt}</div>
            <div class="info-item">✅ Géré par: ${escapeHtml(staff ? staff.user.tag : 'Non assigné')}</div>
        </div>
    </div>

    <div class="messages">
        ${messages.map(msg => {
            const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
            const time = formatDate(msg.createdAt);

            let attachmentsHtml = '';
            if (msg.attachments.size > 0) {
                attachmentsHtml = Array.from(msg.attachments.values()).map(att => {
                    const isImage = att.contentType && att.contentType.startsWith('image/');
                    return `<a href="${att.url}" target="_blank" class="attachment">
                        📎 ${escapeHtml(att.name)}
                        ${isImage ? `<img src="${att.url}" alt="${escapeHtml(att.name)}">` : ''}
                    </a>`;
                }).join('');
            }

            let embedsHtml = '';
            if (msg.embeds.length > 0) {
                embedsHtml = msg.embeds.map(embed => `
                    <div class="embed" style="border-left-color: ${embed.hexColor || '#4f545c'}">
                        ${embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : ''}
                        ${embed.description ? `<div class="embed-desc">${escapeHtml(embed.description)}</div>` : ''}
                        ${embed.fields.map(f => `
                            <div style="margin-top:5px">
                                <strong>${escapeHtml(f.name)}</strong>: ${escapeHtml(f.value)}
                            </div>
                        `).join('')}
                    </div>
                `).join('');
            }

            return `
        <div class="message">
            <img src="${avatarUrl}" class="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <div class="message-content">
                <div class="message-header">
                    <span class="author">${escapeHtml(msg.author.tag)}</span>
                    <span class="timestamp">${time}</span>
                </div>
                <div class="content">${escapeHtml(msg.content || '')}</div>
                ${attachmentsHtml}
                ${embedsHtml}
            </div>
        </div>`;
        }).join('')}
    </div>
</body>
</html>`;

    return Buffer.from(htmlContent, 'utf-8');

  } catch (error) {
    logger.error(`Erreur lors de la génération du transcript: ${error}`);
    // En cas d'erreur, on retourne un buffer simple avec l'erreur
    return Buffer.from(`<html><body><h1>Erreur de génération</h1><p>${escapeHtml(error.message)}</p></body></html>`);
  }
}

module.exports = { generateTranscript };
