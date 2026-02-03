const JOB_CONFIG = {
    name: 'Explorateur',
    slug: 'explorer',
    cooldown: 2 * 60 * 60, // 2 hours
    emoji: '🧭'
};

const LOOT_TABLE = [
    { name: 'Carte ancienne', chance: 25, quantity: 1, xp: 50 },
    { name: 'Relique', chance: 15, quantity: 1, xp: 100 },
    { name: 'Coffre', chance: 8, quantity: 1, xp: 200 },
    { name: 'Artefact', chance: 2, quantity: 1, xp: 500 }
];

function work(level) {
    // Chance de trouver quelque chose : 40% base + 0.2% par niveau (Max 60%)
    const findChance = Math.min(40 + (level * 0.2), 60);
    const roll = Math.random() * 100;

    if (roll > findChance) {
        return {
            items: [],
            totalXp: 10, // Petit XP de consolation pour l'effort
            flavorText: getNothingFlavorText()
        };
    }

    // Sélection du butin pondérée
    const totalWeight = LOOT_TABLE.reduce((acc, item) => acc + item.chance, 0);
    let randomWeight = Math.random() * totalWeight;
    let loot = LOOT_TABLE[0];

    for (const item of LOOT_TABLE) {
        randomWeight -= item.chance;
        if (randomWeight <= 0) {
            loot = item;
            break;
        }
    }

    return {
        items: [
            {
                name: loot.name,
                quantity: loot.quantity,
                xp: loot.xp
            }
        ],
        totalXp: loot.xp,
        flavorText: getFoundFlavorText(loot.name)
    };
}

function getNothingFlavorText() {
    const messages = [
        "🍂 Vous avez marché pendant des heures... rien que des feuilles mortes.",
        "🧭 Votre boussole semble cassée, vous avez tourné en rond.",
        "🕸️ Une vieille ruine vide. Décevant."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function getFoundFlavorText(itemName) {
    const messages = {
        'Carte ancienne': "📜 Sous une pierre, vous trouvez une **Carte ancienne** !",
        'Relique': "🏺 Dans la poussière, une **Relique** intacte brille.",
        'Coffre': "📦 Incroyable ! Un **Coffre** oublié traînait là.",
        'Artefact': "✨ C'est votre jour de chance ! Vous avez découvert un **Artefact** légendaire !"
    };
    return messages[itemName] || `Vous avez découvert : ${itemName}`;
}

module.exports = {
    ...JOB_CONFIG,
    work
};
