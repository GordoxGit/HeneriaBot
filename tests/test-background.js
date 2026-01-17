const fs = require('fs');
const path = require('path');
const { generateBackground } = require('../src/utils/backgroundGenerator');

async function test() {
    console.log('🖼️  Démarrage du test de génération de fond...');

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        console.log(`📂 Création du dossier ${outputDir}...`);
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        console.log('🎨 Génération du fond...');
        const canvas = await generateBackground();

        console.log(`📏 Dimensions du canvas: ${canvas.width}x${canvas.height}`);
        if (canvas.width !== 1024 || canvas.height !== 500) {
            throw new Error(`Dimensions incorrectes: attendu 1024x500, reçu ${canvas.width}x${canvas.height}`);
        }

        const buffer = canvas.toBuffer('image/png');
        const outputPath = path.join(outputDir, 'background-test.png');

        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Fond généré avec succès : ${outputPath}`);

        const stats = fs.statSync(outputPath);
        console.log(`📦 Taille du fichier : ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('❌ Erreur lors du test :', error);
        process.exit(1);
    }
}

test();
