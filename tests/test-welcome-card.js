const { generateWelcomeCard } = require('../src/utils/welcomeCard');
const fs = require('fs');
const path = require('path');

async function runTests() {
    const outputDir = path.join(__dirname, 'output');

    // Création du dossier output s'il n'existe pas
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Dossier créé : ${outputDir}`);
    }

    console.log('--- Test 1: Carte Standard ---');
    const memberStandard = {
        displayName: 'TestUser#1234',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
        user: {
            username: 'TestUser',
            defaultAvatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
        }
    };
    try {
        const buffer = await generateWelcomeCard(memberStandard, 'Heneria');
        fs.writeFileSync(path.join(outputDir, 'welcome-card-test.png'), buffer);
        console.log('✅ Carte standard générée : welcome-card-test.png');
    } catch (e) {
        console.error('❌ Erreur carte standard:', e);
    }

    console.log('\n--- Test 2: Pseudo Long ---');
    const memberLong = {
        displayName: 'SuperLongUsernameThatExceedsLimits',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png',
        user: {
            username: 'SuperLongUsernameThatExceedsLimits',
            defaultAvatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png'
        }
    };
    try {
        const buffer = await generateWelcomeCard(memberLong, 'Heneria');
        fs.writeFileSync(path.join(outputDir, 'welcome-card-long.png'), buffer);
        console.log('✅ Carte pseudo long générée : welcome-card-long.png');
    } catch (e) {
        console.error('❌ Erreur carte pseudo long:', e);
    }

    console.log('\n--- Test 3: Avatar Invalide (Fallback) ---');
    const memberNoAvatar = {
        displayName: 'NoAvatarUser',
        displayAvatarURL: () => 'https://invalid-url-that-does-not-exist.com/image.png',
        user: {
             username: 'NoAvatarUser',
             defaultAvatarURL: 'https://cdn.discordapp.com/embed/avatars/2.png'
        }
    };
    try {
        const buffer = await generateWelcomeCard(memberNoAvatar, 'Heneria');
        fs.writeFileSync(path.join(outputDir, 'welcome-card-no-avatar.png'), buffer);
        console.log('✅ Carte fallback avatar générée : welcome-card-no-avatar.png');
    } catch (e) {
        console.error('❌ Erreur carte fallback avatar:', e);
    }
}

runTests();
