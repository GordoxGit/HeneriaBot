const JOB_CONFIG = {
    name: 'Mineur',
    slug: 'miner',
    cooldown: 30 * 60, // 30 minutes
    emoji: '⛏️'
};

const LOOT_TABLE = [
    { name: 'Diamant', baseChance: 1, xp: 100 },
    { name: 'Fer', baseChance: 9, xp: 50 },
    { name: 'Charbon', baseChance: 30, xp: 15 },
    { name: 'Pierre', baseChance: 60, xp: 5 }
];

/**
 * Exécute le travail de mineur
 * @param {number} level - Le niveau actuel du métier
 * @param {Array<string>} inventory - Liste des noms d'items possédés (non utilisé pour le mineur mais requis par la signature)
 * @param {boolean} isCritical - Si un événement critique (Jackpot) est déclenché
 * @returns {Object} Résultat du travail
 */
function work(level, inventory = [], isCritical = false) {
    // Bonus de chance : +0.5% par niveau pour les items rares (Diamant et Fer)
    // On déduit ce pourcentage de la Pierre (item commun)

    const bonus = (level - 1) * 0.5;

    // Calcul des probabilités ajustées
    let diamondChance = LOOT_TABLE[0].baseChance + bonus;
    let ironChance = LOOT_TABLE[1].baseChance + bonus;
    let coalChance = LOOT_TABLE[2].baseChance;

    // La pierre prend le reste pour faire 100%
    let stoneChance = 100 - (diamondChance + ironChance + coalChance);

    // Sécurité si le niveau est très haut (ne devrait pas arriver vite mais bon)
    if (stoneChance < 0) {
        stoneChance = 0;
        // Si on dépasse 100% avec les rares, on compresse (cas extrême)
        const total = diamondChance + ironChance + coalChance;
        diamondChance = (diamondChance / total) * 100;
        ironChance = (ironChance / total) * 100;
        coalChance = (coalChance / total) * 100;
    }

    // Tirage aléatoire
    const rand = Math.random() * 100;
    let lootItem = null;

    if (rand < diamondChance) {
        lootItem = LOOT_TABLE[0];
    } else if (rand < diamondChance + ironChance) {
        lootItem = LOOT_TABLE[1];
    } else if (rand < diamondChance + ironChance + coalChance) {
        lootItem = LOOT_TABLE[2];
    } else {
        lootItem = LOOT_TABLE[3];
    }

    // Quantité : Peut-être aléatoire plus tard, pour l'instant 1
    // On pourrait ajouter une chance de double drop avec le niveau
    let quantity = 1;
    let flavorSuffix = "";

    // === ÉVÉNEMENT CRITIQUE : JACKPOT ===
    if (isCritical) {
        quantity = 10;
        flavorSuffix = "\n🎰 **JACKPOT !** Vous avez trouvé un filon pur ! (Gain x10)";
    }

    return {
        items: [
            {
                name: lootItem.name,
                quantity: quantity,
                xp: lootItem.xp * quantity // On multiplie aussi l'XP pour récompenser le jackpot
            }
        ],
        totalXp: lootItem.xp * quantity,
        flavorText: getRandomFlavorText(lootItem.name) + flavorSuffix
    };
}

function getRandomFlavorText(itemName) {
    const messages = {
        'Diamant': [
            "💎 **INCROYABLE !** Votre pioche a révélé un **Diamant** étincelant !",
            "💎 La lumière se reflète sur quelque chose... C'est un **Diamant** !"
        ],
        'Fer': [
            "🔩 Vous avez extrait un bon bloc de **Fer**.",
            "🔩 Un filon de **Fer** solide ! Beau travail."
        ],
        'Charbon': [
            "⚫ Vous êtes couvert de suie, mais vous avez trouvé du **Charbon**.",
            "⚫ Utile pour le fourneau... voici du **Charbon**."
        ],
        'Pierre': [
            "🪨 Juste de la **Pierre**... Il faut bien commencer quelque part.",
            "🪨 La roche est dure, mais vous récupérez de la **Pierre**."
        ]
    };

    const list = messages[itemName] || [`Vous avez trouvé : ${itemName}`];
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    ...JOB_CONFIG,
    work
};
