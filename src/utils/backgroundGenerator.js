const { createCanvas } = require('canvas');
const { createGradient } = require('./canvasHelper');

/**
 * Génère un fond d'image aux couleurs Heneria inspiré de l'univers Hytale.
 * @param {number} width - Largeur de l'image (défaut: 1024)
 * @param {number} height - Hauteur de l'image (défaut: 500)
 * @returns {Promise<Canvas>} - Le canvas généré
 */
async function generateBackground(width = 1024, height = 500) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dégradé de fond (Violet Heneria -> Bleu nuit)
    const gradient = createGradient(ctx, 0, 0, 0, height, [
        { offset: 0, color: '#780CED' }, // Violet
        { offset: 1, color: '#1D0342' }  // Bleu nuit
    ]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Ajout de motifs géométriques (style cubique/Hytale)
    // Nous allons dessiner des carrés/rectangles semi-transparents pour donner de la texture
    const numberOfShapes = 20;

    // Sauvegarder l'état du contexte
    ctx.save();

    for (let i = 0; i < numberOfShapes; i++) {
        const size = Math.random() * 100 + 50; // Taille entre 50 et 150
        const x = Math.random() * width;
        const y = Math.random() * height;
        const opacity = Math.random() * 0.1 + 0.05; // Opacité faible (0.05 - 0.15)

        ctx.fillStyle = `rgba(242, 225, 255, ${opacity})`; // Blanc rosé avec transparence

        // On peut faire des carrés ou des rectangles pour le style "bloc"
        // Ici on fait des carrés simples
        ctx.fillRect(x, y, size, size);

        // Ajout d'un contour optionnel pour renforcer l'effet "bloc"
        if (Math.random() > 0.5) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 1.5})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, size, size);
        }
    }

    // 3. Ajout de particules lumineuses (petits cercles)
    const numberOfParticles = 50;
    for (let i = 0; i < numberOfParticles; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 3 + 1;
        const opacity = Math.random() * 0.3 + 0.1;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
    }

    ctx.restore();

    return canvas;
}

module.exports = { generateBackground };
