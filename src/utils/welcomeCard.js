const { generateBackground } = require('./backgroundGenerator');
const { loadImage, createCircle } = require('./canvasHelper');

/**
 * Génère une carte de bienvenue pour un nouveau membre.
 * @param {import('discord.js').GuildMember} member - Le membre qui vient de rejoindre.
 * @param {string} guildName - Le nom du serveur.
 * @returns {Promise<Buffer>} - Le buffer de l'image PNG générée.
 */
async function generateWelcomeCard(member, guildName) {
    // On pourrait utiliser guildName pour personnaliser le texte, mais la spec demande "Bienvenue sur Heneria"
    // On le garde pour la signature demandée mais on ne l'utilise pas pour le moment.
    void guildName;

    // 1. Génération du fond (1024x500)
    const canvas = await generateBackground(1024, 500);
    const ctx = canvas.getContext('2d');

    // 2. Gestion de l'avatar
    let avatarUrl;
    try {
        // Essayer de récupérer l'avatar du membre, sinon avatar par défaut
        avatarUrl = member.displayAvatarURL({ extension: 'png', size: 256 });
    } catch (error) {
        // Fallback sur l'avatar par défaut de Discord si l'objet member est malformé ou erreur
        console.error("Erreur lors de la récupération de l'URL de l'avatar :", error);
        avatarUrl = member.user ? member.user.defaultAvatarURL : 'https://cdn.discordapp.com/embed/avatars/0.png';
    }

    let avatar;
    try {
        avatar = await loadImage(avatarUrl);
    } catch (error) {
        console.warn(`Erreur chargement avatar principal (${avatarUrl}): ${error.message}, tentative fallback...`);
        try {
            const fallbackUrl = member.user ? member.user.defaultAvatarURL : 'https://cdn.discordapp.com/embed/avatars/0.png';
            avatar = await loadImage(fallbackUrl);
        } catch (fallbackError) {
            console.error("Impossible de charger l'avatar de secours :", fallbackError);
        }
    }

    if (avatar) {
        try {
            // Dessiner l'avatar en cercle
            ctx.save();
            // Le centre est à x=512 (412 + 100), y=200 (100 + 100) avec un rayon de 100
            createCircle(ctx, 512, 200, 100);
            ctx.drawImage(avatar, 412, 100, 200, 200);
            ctx.restore();

            // Dessiner la bordure violette
            ctx.beginPath();
            ctx.arc(512, 200, 100, 0, Math.PI * 2);
            ctx.lineWidth = 10;
            ctx.strokeStyle = '#780CED';
            ctx.stroke();
        } catch (drawError) {
            console.error("Erreur lors du dessin de l'avatar :", drawError);
        }
    }

    // 3. Texte principal "Bienvenue sur Heneria"
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // Pour un positionnement vertical précis
    ctx.fillText('Bienvenue sur Heneria', 512, 340);

    // 4. Pseudo du membre
    const pseudo = member.displayName || (member.user ? member.user.username : 'Membre');

    // Configuration de base pour le pseudo
    let fontSize = 36;
    ctx.fillStyle = '#780CED';

    // Réduction de la taille de police si le pseudo est trop long (> 20 caractères)
    if (pseudo.length > 20) {
        // On réduit proportionnellement, mais pas en dessous de 20px pour rester lisible
        const ratio = 20 / pseudo.length;
        fontSize = Math.max(20, Math.floor(36 * ratio));
    } else {
        // Vérification de la largeur pour s'assurer que ça rentre même avec < 20 caractères (ex: WWW...)
        ctx.font = `bold ${fontSize}px Arial`;
        const maxWidth = 900; // Marge de sécurité
        while (ctx.measureText(pseudo).width > maxWidth && fontSize > 20) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px Arial`;
        }
    }

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillText(pseudo, 512, 400);

    // Retourne le buffer PNG
    return canvas.toBuffer('image/png');
}

module.exports = { generateWelcomeCard };
