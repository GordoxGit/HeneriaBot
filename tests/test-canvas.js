const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { createGradient, drawCenteredText } = require('../src/utils/canvasHelper');

async function runTest() {
    const width = 500;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fond violet (dégradé)
    // Utilisation des couleurs Heneria : Main (#780CED), Dark (#1D0342)
    const gradient = createGradient(ctx, 0, 0, width, height, [
        { offset: 0, color: '#780CED' },
        { offset: 1, color: '#1D0342' }
    ]);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Texte blanc
    ctx.font = 'bold 30px Sans';
    ctx.fillStyle = '#FFFFFF';

    // On centre verticalement approximativement
    drawCenteredText(ctx, "Test Canvas Heneria", width / 2, height / 2, width - 40);

    // Sauvegarde
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(__dirname, 'output', 'test-canvas.png');

    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Image test générée : ${outputPath}`);
}

runTest().catch(err => {
    console.error('❌ Erreur lors du test :', err);
    process.exit(1);
});
