const db = require('../src/database/db');
const config = require('../src/config');
const path = require('path');
const fs = require('fs');

try {
    // 1. Initialiser la DB (Création des tables si elles n'existent pas)
    console.log('Initializing database...');
    db.init();

    // 2. Tenter d'ajouter la colonne unlocked si elle n'existe pas (Migration défensive)
    // Utile si la table existait déjà avec l'ancien schéma
    console.log('Checking schema...');
    try {
        db.run("ALTER TABLE job_progress ADD COLUMN unlocked INTEGER DEFAULT 0");
        console.log('Column unlocked added successfully via ALTER.');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('Column unlocked already exists (or created via init).');
        } else {
            // Si l'erreur n'est pas "duplicate column", c'est peut-être autre chose, mais on continue
            console.log('Note: ALTER TABLE failed (expected if table created fresh):', e.message);
        }
    }

    // 3. Insérer les items dans shop_items pour toutes les guildes
    console.log('Inserting new items...');

    // Récupérer toutes les guildes
    const guilds = db.all("SELECT guild_id FROM guilds");
    console.log(`Found ${guilds.length} guilds.`);

    if (guilds.length === 0) {
        console.log("No guilds found. Inserting dummy guild for testing items if needed, or skipping.");
        // Optional: Insert a dummy guild to ensure items are inserted for verification?
        // Let's insert a dummy guild just in case, so we can verify the items exist.
        // db.run("INSERT OR IGNORE INTO guilds (guild_id, name) VALUES (?, ?)", ['default', 'Test Guild']);
        // guilds.push({ guild_id: 'default' });
    }

    const items = [
        { name: 'Arc', price: 5000, description: 'Arme de base pour le chasseur.' },
        { name: 'Fusil', price: 15000, description: 'Arme avancée pour le chasseur. Augmente les chances de réussite.' },
        { name: 'Trophée de chasse', price: 1000, description: 'Preuve de votre talent de chasseur.' },
        { name: 'Peau légendaire', price: 2500, description: 'Peau rare obtenue sur des créatures d\'élite.' },
        { name: 'Essence du vide', price: 5000, description: 'Matériau mystérieux et puissant.' }
    ];

    for (const guild of guilds) {
        console.log(`Processing guild ${guild.guild_id}...`);
        for (const item of items) {
            const existing = db.get("SELECT id FROM shop_items WHERE guild_id = ? AND name = ?", [guild.guild_id, item.name]);
            if (!existing) {
                db.run(`
                    INSERT INTO shop_items (guild_id, name, description, price, stock)
                    VALUES (?, ?, ?, ?, -1)
                `, [guild.guild_id, item.name, item.description, item.price]);
                console.log(`  Added item: ${item.name}`);
            } else {
                console.log(`  Item exists: ${item.name}`);
            }
        }
    }

    console.log('Migration completed successfully.');

} catch (error) {
    console.error('Migration failed:', error);
} finally {
    db.close();
}
