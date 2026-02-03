const JOB_CONFIG = {
    name: 'Chasseur',
    slug: 'hunter',
    cooldown: 4 * 60 * 60, // 4 heures
    emoji: '🏹'
};

const LOOT_TABLE = [
    { name: 'Essence du vide', baseChance: 5, xp: 500 },
    { name: 'Peau légendaire', baseChance: 15, xp: 250 },
    { name: 'Trophée de chasse', baseChance: 40, xp: 100 },
    { name: 'Os', baseChance: 100, xp: 25 } // Fallback
];

/**
 * Exécute le travail de chasseur
 * @param {number} level - Le niveau actuel du métier
 * @param {Array<string>} inventory - Liste des noms d'items possédés (ex: ['Arc', 'Pierre'])
 * @param {boolean} isCritical - Si un événement critique (Boss) est déclenché
 * @returns {Object} Résultat du travail
 */
function work(level, inventory = [], isCritical = false) {
    // === ÉVÉNEMENT CRITIQUE : BOSS ===
    if (isCritical) {
        return {
            items: [
                { name: 'Peau légendaire', quantity: 2, xp: 1000 },
                { name: 'Essence du vide', quantity: 1, xp: 1000 }
            ],
            totalXp: 2000,
            flavorText: "🐉 **UN BOSS APPARAÎT !**\nVous tombez nez à nez avec un **Dragon du Vide** !\nAprès un combat épique, vous parvenez à le terrasser et récupérez un butin légendaire !"
        };
    }

    // === PHASE 1 : TRAQUE ===
    // 30% de chance de ne rien trouver
    // Le niveau réduit légèrement ce risque (0.5% par niveau, max 20% de réduction)
    const failChance = Math.max(10, 30 - (level * 0.5));
    const trackRoll = Math.random() * 100;

    if (trackRoll < failChance) {
        return {
            items: [],
            totalXp: 10,
            flavorText: "🐾 Vous avez suivi des traces pendant des heures... mais la bête vous a échappé.",
            reduceCooldown: true // Indique à work.js de réduire le cooldown
        };
    }

    // === PHASE 2 : AFFRONTEMENT ===
    // Calcul de la puissance du joueur
    // Base 50% + (Niveau * 2)%
    let winChance = 50 + (level * 2);

    // Bonus d'équipement
    if (inventory.includes('Fusil')) {
        winChance += 30;
    } else if (inventory.includes('Arc')) {
        winChance += 15;
    }

    // Cap à 95%
    if (winChance > 95) winChance = 95;

    const fightRoll = Math.random() * 100;

    if (fightRoll > winChance) {
        // Défaite
        return {
            items: [],
            totalXp: 20, // XP de consolation
            flavorText: "⚔️ **Échec !** La bête était trop forte. Vous avez dû fuir pour survivre."
        };
    }

    // === VICTOIRE : LOOT ===
    // On détermine le butin
    const rand = Math.random() * 100;
    let lootItem = LOOT_TABLE[3]; // Fallback (Os/Viande/Rien -> ici Os pour simplifier)

    // Logique de drop simplifiée
    if (rand < LOOT_TABLE[0].baseChance + (level * 0.2)) {
        lootItem = LOOT_TABLE[0]; // Essence
    } else if (rand < LOOT_TABLE[1].baseChance + (level * 0.5)) {
        lootItem = LOOT_TABLE[1]; // Peau
    } else if (rand < LOOT_TABLE[2].baseChance + (level * 1)) {
        lootItem = LOOT_TABLE[2]; // Trophée
    }

    return {
        items: [
            {
                name: lootItem.name,
                quantity: 1,
                xp: lootItem.xp
            }
        ],
        totalXp: lootItem.xp,
        flavorText: getRandomFlavorText(lootItem.name)
    };
}

function getRandomFlavorText(itemName) {
    const messages = {
        'Essence du vide': [
            "🔮 Vous avez abattu une créature corrompue et récupéré son **Essence du vide**.",
            "🔮 Une énergie sombre émane de votre prise : une **Essence du vide**."
        ],
        'Peau légendaire': [
            "✨ Quelle prise ! Cette **Peau légendaire** vaudra une fortune.",
            "✨ La créature était majestueuse. Sa **Peau légendaire** est désormais vôtre."
        ],
        'Trophée de chasse': [
            "🦌 Un tir propre. Vous rapportez un magnifique **Trophée de chasse**.",
            "🦌 C'est une belle bête. Un **Trophée de chasse** de plus à votre collection."
        ],
        'Os': [
            "☠️ Le combat fut rude et la bête abîmée. Vous ne récupérez que des **Os**.",
            "☠️ Pas grand chose à tirer de cette carcasse, à part quelques **Os**."
        ]
    };

    const list = messages[itemName] || [`Vous avez chassé : ${itemName}`];
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    ...JOB_CONFIG,
    work
};
