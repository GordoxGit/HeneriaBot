const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const path = require('path');
const fs = require('fs');
const { COLORS } = require('../../config/constants');

// Chargement dynamique des métiers disponibles
const jobsPath = path.join(__dirname, '../../jobs');
let availableJobs = [];

try {
    if (fs.existsSync(jobsPath)) {
        availableJobs = fs.readdirSync(jobsPath)
            .filter(file => file.endsWith('.js'))
            .map(file => {
                try {
                    const job = require(path.join(jobsPath, file));
                    if (job.name && job.slug) {
                        return { name: job.name, value: job.slug };
                    }
                } catch (e) {
                    console.error(`Erreur chargement métier ${file}:`, e);
                }
                return null;
            })
            .filter(j => j !== null);
    }
} catch (error) {
    console.error("Erreur lecture dossier jobs:", error);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Système de métiers et de travail')
        .addSubcommand(sub =>
            sub.setName('perform')
                .setDescription('Effectuer votre travail quotidien'))
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Voir les informations sur votre métier actuel'))
        .addSubcommand(sub =>
            sub.setName('choose')
                .setDescription('Choisir un métier')
                .addStringOption(option =>
                    option.setName('job')
                        .setDescription('Le métier à rejoindre')
                        .setRequired(true)
                        .addChoices(...availableJobs)
                )),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // --- SOUS-COMMANDE: CHOOSE ---
        if (subcommand === 'choose') {
            const jobSlug = interaction.options.getString('job');
            const jobFile = path.join(jobsPath, `${jobSlug}.js`);

            if (!fs.existsSync(jobFile)) {
                return interaction.reply({
                    content: "Ce métier n'est pas disponible.",
                    ephemeral: true
                });
            }

            const jobData = require(jobFile);

            const existing = db.get(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [userId, guildId, jobSlug]
            );

            const now = Math.floor(Date.now() / 1000);

            try {
                if (existing) {
                    // Mise à jour du timestamp pour rendre ce métier "actif" (le plus récent)
                    // Cela applique aussi le cooldown, ce qui est logique pour un changement de poste
                    db.run(
                        `UPDATE job_progress SET last_worked = ? WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                        [now, userId, guildId, jobSlug]
                    );

                    return interaction.reply({
                        embeds: [createEmbed()
                            .setTitle(`${jobData.emoji || ''} Métier : ${jobData.name}`)
                            .setDescription(`Vous avez repris votre poste de **${jobData.name}**.\nNiveau actuel : ${existing.level}\n\n*Le changement de poste nécessite un temps de préparation (Cooldown activé).*`)
                            .setColor(COLORS.SUCCESS)
                        ]
                    });
                } else {
                    // Insertion du nouveau métier
                    db.run(
                        `INSERT INTO job_progress (user_id, guild_id, job_slug, last_worked) VALUES (?, ?, ?, ?)`,
                        [userId, guildId, jobSlug, now]
                    );

                    return interaction.reply({
                        embeds: [createEmbed()
                            .setTitle(`Nouveau Métier : ${jobData.name}`)
                            .setDescription(`Félicitations ! Vous êtes maintenant **${jobData.name}**.\nUtilisez \`/work perform\` pour commencer à travailler (après le temps de préparation).`)
                            .setColor(COLORS.SUCCESS)
                        ]
                    });
                }
            } catch (e) {
                console.error("Erreur choose job:", e);
                return interaction.reply({ content: "Une erreur est survenue.", ephemeral: true });
            }
        }

        // --- SOUS-COMMANDE: INFO ---
        if (subcommand === 'info') {
            // Affiche le métier le plus récemment utilisé ou le premier trouvé
            const progressList = db.all(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? ORDER BY last_worked DESC`,
                [userId, guildId]
            );

            if (progressList.length === 0) {
                return interaction.reply({
                    content: "Vous n'avez pas encore choisi de métier. Utilisez `/work choose`.",
                    ephemeral: true
                });
            }

            const validJobs = progressList.map(p => {
                const pPath = path.join(jobsPath, `${p.job_slug}.js`);
                if (fs.existsSync(pPath)) return { ...p, config: require(pPath) };
                return null;
            }).filter(j => j !== null);

            if (validJobs.length === 0) {
                 return interaction.reply({ content: "Erreur: Vos métiers semblent invalides.", ephemeral: true });
            }

            const mainJob = validJobs[0];
            const nextLevelXp = mainJob.level * 100;
            const now = Math.floor(Date.now() / 1000);
            const cooldownEnd = mainJob.last_worked + (mainJob.config.cooldown || 3600);
            const isReady = now >= cooldownEnd;

            const embed = createEmbed()
                .setTitle(`${mainJob.config.emoji || ''} Métier : ${mainJob.config.name}`)
                .addFields(
                    { name: 'Niveau', value: `${mainJob.level}`, inline: true },
                    { name: 'Expérience', value: `${mainJob.experience} / ${nextLevelXp} XP`, inline: true },
                    { name: 'Disponibilité', value: isReady ? "✅ Disponible" : `<t:${cooldownEnd}:R>`, inline: true }
                )
                .setColor(COLORS.PRIMARY);

            return interaction.reply({ embeds: [embed] });
        }

        // --- SOUS-COMMANDE: PERFORM (ou Default) ---
        if (subcommand === 'perform') {
            const progressList = db.all(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? ORDER BY last_worked DESC LIMIT 1`,
                [userId, guildId]
            );

            if (progressList.length === 0) {
                return interaction.reply({
                    content: "Vous devez d'abord choisir un métier avec `/work choose`.",
                    ephemeral: true
                });
            }

            const userJob = progressList[0];
            const jobFilePath = path.join(jobsPath, `${userJob.job_slug}.js`);

            if (!fs.existsSync(jobFilePath)) {
                 return interaction.reply({ content: "Erreur interne: Fichier métier introuvable.", ephemeral: true });
            }

            const jobModule = require(jobFilePath);

            // Vérification Cooldown
            const now = Math.floor(Date.now() / 1000);
            const cooldownEnd = userJob.last_worked + (jobModule.cooldown || 3600);

            if (now < cooldownEnd) {
                return interaction.reply({
                    content: `⏳ Vous êtes fatigué ! Vous pourrez travailler à nouveau <t:${cooldownEnd}:R>.`,
                    ephemeral: true
                });
            }

            // Exécution du travail
            const result = jobModule.work(userJob.level);
            // result attendu: { items: [{name, quantity, xp}], totalXp, flavorText }

            // Vérification de l'existence des items dans le shop du serveur
            const itemNames = result.items.map(i => i.name);
            const shopItems = [];

            for (const name of itemNames) {
                const item = db.get(
                    `SELECT * FROM shop_items WHERE guild_id = ? AND name = ?`,
                    [guildId, name]
                );
                if (!item) {
                    return interaction.reply({
                        content: `⚠️ **Erreur de Configuration** : L'objet **${name}** n'existe pas dans le magasin de ce serveur.\nVeuillez demander à un administrateur de créer l'objet via \`/shop admin add name:${name}\`.`,
                        ephemeral: true
                    });
                }
                shopItems.push({ ...item, quantity: result.items.find(i => i.name === name).quantity });
            }

            // Sauvegarde (Transaction)
            let leveledUp = false;
            let newLevel = userJob.level;

            try {
                db.transaction(() => {
                    // Mise à jour de l'inventaire
                    for (const sItem of shopItems) {
                        const existingInv = db.get(
                            `SELECT quantity FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                            [userId, guildId, sItem.id]
                        );

                        if (existingInv) {
                            db.run(
                                `UPDATE inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                                [sItem.quantity, userId, guildId, sItem.id]
                            );
                        } else {
                            db.run(
                                `INSERT INTO inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)`,
                                [userId, guildId, sItem.id, sItem.quantity]
                            );
                        }
                    }

                    // Calcul XP et Niveaux
                    let currentXp = userJob.experience + result.totalXp;
                    let xpNeeded = newLevel * 100;

                    // Boucle de level up
                    while (currentXp >= xpNeeded) {
                        currentXp -= xpNeeded;
                        newLevel++;
                        leveledUp = true;
                        xpNeeded = newLevel * 100;
                    }

                    // Mise à jour de la progression
                    db.run(
                        `UPDATE job_progress SET experience = ?, level = ?, last_worked = ? WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                        [currentXp, newLevel, now, userId, guildId, userJob.job_slug]
                    );

                })();
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: "Une erreur est survenue lors de la sauvegarde de votre travail.", ephemeral: true });
            }

            // Réponse
            const embed = createEmbed()
                .setTitle(`${jobModule.emoji || '🔨'} Travail terminé`)
                .setDescription(result.flavorText)
                .setColor(COLORS.SUCCESS)
                .addFields(
                    { name: 'Gains', value: result.items.map(i => `+${i.quantity} **${i.name}**`).join('\n') || 'Rien', inline: true },
                    { name: 'Expérience', value: `+${result.totalXp} XP`, inline: true }
                );

            if (leveledUp) {
                embed.addFields({ name: '🎉 NIVEAU SUPÉRIEUR !', value: `Vous êtes passé au niveau **${newLevel}** !`, inline: false });
            }

            embed.setFooter({ text: `Niveau Actuel: ${newLevel} • XP: ${newLevel * 100 - userJob.experience - result.totalXp > 0 ? (newLevel * 100) - (userJob.experience + result.totalXp) : 0} restants` });
            // Note: Footer calculation approximation for visual sake, exact calculation is tricky without re-evaluating loop.
            // Simplified:
            embed.setFooter({ text: `Niveau ${newLevel}` });

            return interaction.reply({ embeds: [embed] });
        }
    }
};
