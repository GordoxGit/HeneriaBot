const { loadImage: canvasLoadImage } = require('canvas');

/**
 * Télécharge et charge une image depuis une URL
 * @param {string} url - L'URL de l'image
 * @returns {Promise<Image>} - L'image chargée
 */
async function loadImage(url) {
    try {
        return await canvasLoadImage(url);
    } catch (error) {
        console.error(`Erreur lors du chargement de l'image: ${url}`, error);
        throw error;
    }
}

/**
 * Crée un chemin circulaire pour clipper (utile pour les avatars)
 * @param {CanvasRenderingContext2D} ctx - Le contexte Canvas
 * @param {number} x - Coordonnée X du centre
 * @param {number} y - Coordonnée Y du centre
 * @param {number} radius - Rayon du cercle
 */
function createCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
}

/**
 * Crée un dégradé linéaire
 * @param {CanvasRenderingContext2D} ctx - Le contexte Canvas
 * @param {number} x0 - X de départ
 * @param {number} y0 - Y de départ
 * @param {number} x1 - X de fin
 * @param {number} y1 - Y de fin
 * @param {Array<{offset: number, color: string}>} colorStops - Tableau de couleurs avec positions
 * @returns {CanvasGradient} - Le dégradé créé
 */
function createGradient(ctx, x0, y0, x1, y1, colorStops) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    colorStops.forEach(stop => {
        gradient.addColorStop(stop.offset, stop.color);
    });
    return gradient;
}

/**
 * Dessine du texte centré horizontalement avec gestion du retour à la ligne
 * @param {CanvasRenderingContext2D} ctx - Le contexte Canvas
 * @param {string} text - Le texte à écrire
 * @param {number} x - Coordonnée X du centre
 * @param {number} y - Coordonnée Y de départ
 * @param {number} maxWidth - Largeur maximale autorisée
 */
function drawCenteredText(ctx, text, x, y, maxWidth) {
    // Sauvegarder l'alignement actuel
    const originalTextAlign = ctx.textAlign;
    ctx.textAlign = 'center';

    const words = text.split(' ');
    let line = '';
    let currentY = y;

    // Estimation de la hauteur de ligne (approximatif si non disponible)
    const metrics = ctx.measureText('M');
    // Utilisation de emHeightAscent/Descent si dispo, sinon fallback simple
    const lineHeight = (metrics.emHeightAscent + metrics.emHeightDescent) ||
                       (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) ||
                       30; // Valeur par défaut si tout échoue

    // Marge entre les lignes (1.2x)
    const lineSpacing = lineHeight * 1.2;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineSpacing;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);

    // Restaurer l'alignement
    ctx.textAlign = originalTextAlign;
}

module.exports = {
    loadImage,
    createCircle,
    createGradient,
    drawCenteredText
};
