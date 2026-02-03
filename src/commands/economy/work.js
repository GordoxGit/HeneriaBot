const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const path = require('path');
const fs = require('fs');
const { COLORS } = require('../../config/constants');

// Chargement dynamique des métiers disponibles
const jobsPath = path.join(__dirname, '../../jobs');
let availableJobs = [];

// Configuration des pré-requis pour les métiers
const JOB_REQUIREMENTS = {
    hunter: { job: 'warrior', level: 5, name: 'Guerrier' }
};

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

            // Vérification si le métier est déjà débloqué ou possédé
            const existing = db.get(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [userId, guildId, jobSlug]
            );

            // Vérification des pré-requis (Sauf si déjà débloqué explicitement via la colonne unlocked)
            const isUnlocked = existing && existing.unlocked === 1;
            const req = JOB_REQUIREMENTS[jobSlug];

            if (req && !isUnlocked) {
                const reqJob = db.get(
                    `SELECT level FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                    [userId, guildId, req.job]
                );

                if (!reqJob || reqJob.level < req.level) {
                    return interaction.reply({
                        embeds: [createEmbed()
                            .setTitle('🔒 Métier Verrouillé')
                            .setDescription(`Pour devenir **${jobData.name}**, vous devez atteindre le niveau **${req.level}** dans le métier **${req.name}**.`)
                            .setColor(COLORS.ERROR)
                        ],
                        ephemeral: true
                    });
                }
            }

            const now = Math.floor(Date.now() / 1000);

            try {
                if (existing) {
                    // Mise à jour du timestamp pour rendre ce métier "actif" (le plus récent)
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

            // Récupération de l'inventaire pour la logique du métier (Armes, Outils...)
            let inventoryItems = [];
            try {
                inventoryItems = db.all(
                    `SELECT si.name FROM inventory i
                     JOIN shop_items si ON i.item_id = si.id
                     WHERE i.user_id = ? AND i.guild_id = ? AND i.quantity > 0`,
                    [userId, guildId]
                ).map(row => row.name);
            } catch (err) {
                console.error("Erreur récupération inventaire:", err);
            }

            // Événement Critique (RNG 1/1000)
            const isCritical = Math.random() < 0.001;

            // Exécution du travail
            // On passe l'inventaire et le flag critique
            const result = jobModule.work(userJob.level, inventoryItems, isCritical);

            // Gestion du cooldown dynamique (ex: Hunter tracking fail -> reduceCooldown)
            let workedTimestamp = now;
            if (result.reduceCooldown) {
                workedTimestamp = now - Math.floor((jobModule.cooldown || 3600) / 2);
            }

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
                        [currentXp, newLevel, workedTimestamp, userId, guildId, userJob.job_slug]
                    );

                })();
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: "Une erreur est survenue lors de la sauvegarde de votre travail.", ephemeral: true });
            }

            // Construction de l'Embed de réponse
            const embed = createEmbed()
                .setTitle(`${jobModule.emoji || '🔨'} Travail terminé`)
                .setDescription(result.flavorText)
                .setColor(isCritical ? '#FFD700' : COLORS.SUCCESS) // Or pour critique, Vert pour normal
                .addFields(
                    { name: 'Gains', value: result.items.map(i => `+${i.quantity} **${i.name}**`).join('\n') || 'Rien', inline: true },
                    { name: 'Expérience', value: `+${result.totalXp} XP`, inline: true }
                );

            if (leveledUp) {
                embed.addFields({ name: '🎉 NIVEAU SUPÉRIEUR !', value: `Vous êtes passé au niveau **${newLevel}** !`, inline: false });
            }

            // Si c'est un critique, on mentionne le canal (sauf si ephemeral, mais ici on répond publiquement par défaut sauf si erreur)
            // Wait, interaction.reply is default. Should we make it visible? Current code uses ephemeral: false (default)
            // But if critical, maybe we want to ping or just distinct visual.
            // The prompt says: "Envoyer le message dans le salon avec une mention spéciale ou une couleur dorée"

            // Footer
            embed.setFooter({ text: `Niveau ${newLevel}` });

            // Si cooldown réduit (Hunter fail)
            if (result.reduceCooldown) {
                embed.addFields({ name: '⏱️ Cooldown', value: "Le temps de repos a été réduit de moitié.", inline: false });
            }

            if (isCritical) {
                 // On envoie un message spécial en plus de l'embed ou dans le content ?
                 // On va mettre un content visible.
                 return interaction.reply({
                     content: `🌟 **ÉVÉNEMENT RARE !** <@${userId}> a déclenché quelque chose d'incroyable !`,
                     embeds: [embed]
                 });
            }

            return interaction.reply({ embeds: [embed] });
        }
    }
};
