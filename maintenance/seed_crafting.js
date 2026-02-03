const db = require('../src/database/db');
const GUILD_ID = process.argv[2] || 'test_guild';

console.log(`Seeding for Guild ID: ${GUILD_ID}`);

try {
    db.init();

    // 1. Items
    const items = [
        // Miner
        { name: 'Pierre', price: 1, description: 'Un caillou.' },
        { name: 'Charbon', price: 5, description: 'Combustible.' },
        { name: 'Fer', price: 15, description: 'Métal résistant.' },
        { name: 'Diamant', price: 100, description: 'Brillant et dur.' },
        // Warrior
        { name: 'Cuir', price: 10, description: 'Peau tannée.' },
        { name: 'Os', price: 5, description: 'Restes de squelette.' },
        { name: 'Viande', price: 8, description: 'Nourriture.' },
        { name: 'Pièces d\'or', price: 1, description: 'Monnaie ancienne.' },
        // Explorer
        { name: 'Carte ancienne', price: 50, description: 'Mène vers un trésor ?' },
        { name: 'Relique', price: 150, description: 'Objet ancien.' },
        { name: 'Coffre', price: 300, description: 'Contient des surprises.' },
        { name: 'Artefact', price: 1000, description: 'Légendaire.' },
        // Crafted Results
        { name: 'Épée en Fer', price: 100, description: 'Arme de base.' },
        { name: 'Armure en Cuir', price: 80, description: 'Protection légère.' },
        { name: 'Amulette d\'Os', price: 200, description: 'Bijou macabre.' }
    ];

    for (const item of items) {
        const existing = db.get('SELECT id FROM shop_items WHERE guild_id = ? AND name = ?', [GUILD_ID, item.name]);
        if (!existing) {
            db.run('INSERT INTO shop_items (guild_id, name, description, price, stock) VALUES (?, ?, ?, ?, -1)',
                [GUILD_ID, item.name, item.description, item.price]);
            console.log(`+ Added Item: ${item.name}`);
        } else {
            console.log(`= Item exists: ${item.name}`);
        }
    }

    // 2. Recipes
    // Helper to get ID
    const getId = (name) => {
        const row = db.get('SELECT id FROM shop_items WHERE guild_id = ? AND name = ?', [GUILD_ID, name]);
        return row ? row.id : null;
    };

    const recipes = [
        {
            result: 'Épée en Fer',
            materials: { 'Fer': 2, 'Cuir': 1 },
            level: 1
        },
        {
            result: 'Armure en Cuir',
            materials: { 'Cuir': 5 },
            level: 1
        },
        {
            result: 'Amulette d\'Os',
            materials: { 'Os': 10, 'Relique': 1 }, // Uses Explorer item too!
            level: 5
        }
    ];

    for (const recipe of recipes) {
        const resultId = getId(recipe.result);
        if (!resultId) {
            console.error(`Result item not found: ${recipe.result}`);
            continue;
        }

        const existing = db.get('SELECT id FROM recipes WHERE result_item_id = ?', [resultId]);
        if (!existing) {
            db.run('INSERT INTO recipes (result_item_id, materials, required_job_level) VALUES (?, ?, ?)',
                [resultId, JSON.stringify(recipe.materials), recipe.level]);
            console.log(`+ Added Recipe: ${recipe.result}`);
        } else {
            console.log(`= Recipe exists: ${recipe.result}`);
        }
    }

    console.log("Seeding complete.");

} catch (e) {
    console.error(e);
}
