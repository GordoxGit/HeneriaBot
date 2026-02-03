const JOB_CONFIG = {
    name: 'Guerrier',
    slug: 'warrior',
    cooldown: 60 * 60, // 1 hour
    emoji: '⚔️'
};

const LOOT_TABLE = [
    { name: 'Pièces d\'or', min: 10, max: 50, xp: 20 },
    { name: 'Cuir', min: 1, max: 3, xp: 30 },
    { name: 'Os', min: 1, max: 5, xp: 15 },
    { name: 'Viande', min: 1, max: 2, xp: 25 }
];

function work(level) {
    // Chance de victoire : 60% base + 0.3% par niveau (Max 90%)
    const winChance = Math.min(60 + (level * 0.3), 90);
    const roll = Math.random() * 100;

    if (roll > winChance) {
        return {
            items: [],
            totalXp: 0,
            flavorText: getLossFlavorText()
        };
    }

    // Victoire : On gagne un item aléatoire
    const itemIndex = Math.floor(Math.random() * LOOT_TABLE.length);
    const loot = LOOT_TABLE[itemIndex];
    const quantity = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;

    return {
        items: [
            {
                name: loot.name,
                quantity: quantity,
                xp: loot.xp
            }
        ],
        totalXp: loot.xp * quantity,
        flavorText: getWinFlavorText(loot.name, quantity)
    };
}

function getLossFlavorText() {
    const messages = [
        "💀 Vous avez croisé un Troll des Cavernes... Il était plus fort. Vous fuyez pour soigner vos blessures.",
        "⚔️ Le combat a mal tourné. Votre épée s'est brisée et vous avez dû battre en retraite.",
        "🩸 Un squelette vous a surpris. Vous rentrez bredouille et blessé."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function getWinFlavorText(itemName, quantity) {
    const messages = {
        'Pièces d\'or': `💰 Vous avez vaincu un bandit et récupéré sa bourse contenant **${quantity} Pièces d'or** !`,
        'Cuir': `🐺 Vous avez chassé un loup et récupéré **${quantity} Cuir** de qualité.`,
        'Os': `☠️ Après avoir vaincu un squelette, vous ramassez **${quantity} Os**.`,
        'Viande': `🍖 Une bonne chasse ! Vous rentrez avec **${quantity} Viande**.`
    };
    return messages[itemName] || `Vous avez gagné ${quantity} ${itemName} !`;
}

module.exports = {
    ...JOB_CONFIG,
    work
};
