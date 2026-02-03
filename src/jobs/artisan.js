const JOB_CONFIG = {
    name: 'Artisan',
    slug: 'artisan',
    cooldown: 60, // 1 minute
    emoji: '🔨'
};

function work(level) {
    return {
        items: [],
        totalXp: 0,
        flavorText: "L'Artisanat ne se pratique pas à la va-vite ! Utilisez la commande **/craft** pour fabriquer des objets et gagner de l'expérience."
    };
}

module.exports = {
    ...JOB_CONFIG,
    work
};
