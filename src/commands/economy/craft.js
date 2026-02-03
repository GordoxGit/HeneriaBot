const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Système d\'artisanat')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Voir les recettes disponibles'))
        .addSubcommand(sub =>
            sub.setName('make')
                .setDescription('Fabriquer un objet')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Nom de l\'objet à fabriquer')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // Check if user is Artisan
        const job = db.get(
            `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = 'artisan'`,
            [userId, guildId]
        );

        if (!job && subcommand === 'make') {
             return interaction.reply({
                embeds: [errorEmbed("Vous devez être **Artisan** pour fabriquer des objets.\nUtilisez `/work choose artisan`.")],
                ephemeral: true
            });
        }

        if (subcommand === 'list') {
            const recipes = db.all(`
                SELECT r.*, s.name as result_name, s.price as result_value
                FROM recipes r
                JOIN shop_items s ON r.result_item_id = s.id
                WHERE s.guild_id = ?
            `, [guildId]);

            if (recipes.length === 0) {
                return interaction.reply({
                    embeds: [createEmbed().setTitle('Livre des Recettes').setDescription("Aucune recette n'est disponible pour le moment.").setColor(COLORS.INFO)],
                    ephemeral: true
                });
            }

            const embed = createEmbed()
                .setTitle('⚒️ Livre des Recettes')
                .setColor(COLORS.PRIMARY);

            let description = "";
            for (const recipe of recipes) {
                let matString = "";
                try {
                    const materials = JSON.parse(recipe.materials);
                    matString = Object.entries(materials)
                        .map(([name, qty]) => `${qty}x ${name}`)
                        .join(', ');
                } catch (e) {
                    matString = "Erreur de lecture des matériaux";
                }

                const lockIcon = (job && job.level >= recipe.required_job_level) ? "🔓" : "🔒";
                description += `${lockIcon} **${recipe.result_name}** (Niv. ${recipe.required_job_level})\n   Matériaux : ${matString}\n\n`;
            }

            embed.setDescription(description);
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'make') {
            const itemName = interaction.options.getString('item');

            // Find recipe
            const recipe = db.get(`
                SELECT r.*, s.name as result_name, s.id as result_id
                FROM recipes r
                JOIN shop_items s ON r.result_item_id = s.id
                WHERE s.guild_id = ? AND LOWER(s.name) = LOWER(?)
            `, [guildId, itemName]);

            if (!recipe) {
                return interaction.reply({
                    embeds: [errorEmbed(`Aucune recette trouvée pour **${itemName}**.\nVérifiez l'orthographe ou consultez \`/craft list\`.`)],
                    ephemeral: true
                });
            }

            // Check Level
            if (job.level < recipe.required_job_level) {
                 return interaction.reply({
                    embeds: [errorEmbed(`Niveau insuffisant !\nVous devez être Artisan niveau **${recipe.required_job_level}** (Actuel: ${job.level}).`)],
                    ephemeral: true
                });
            }

            // Check Materials
            let materials;
            try {
                materials = JSON.parse(recipe.materials);
            } catch (e) {
                 return interaction.reply({
                    embeds: [errorEmbed("Erreur interne : Recette invalide (JSON).")],
                    ephemeral: true
                });
            }

            const materialNames = Object.keys(materials);
            if (materialNames.length === 0) {
                 return interaction.reply({ embeds: [errorEmbed("Cette recette ne nécessite aucun matériau ? C'est louche.")], ephemeral: true });
            }

            const placeholders = materialNames.map(() => '?').join(',');
            const shopMaterials = db.all(
                `SELECT * FROM shop_items WHERE guild_id = ? AND name IN (${placeholders})`,
                [guildId, ...materialNames]
            );

            // Check if all materials exist in shop
            for (const name of materialNames) {
                if (!shopMaterials.find(s => s.name === name)) {
                    return interaction.reply({
                        embeds: [errorEmbed(`Erreur technique: Le matériau **${name}** n'existe pas dans la base de données (Shop Items).\nContactez un admin.`)],
                        ephemeral: true
                    });
                }
            }

            // Check Inventory
            const missing = [];
            const inventoryUpdates = []; // { itemId, quantityToRemove }

            for (const name of materialNames) {
                const requiredQty = materials[name];
                const shopItem = shopMaterials.find(s => s.name === name);
                const invItem = db.get(
                    `SELECT quantity FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                    [userId, guildId, shopItem.id]
                );

                const currentQty = invItem ? invItem.quantity : 0;
                if (currentQty < requiredQty) {
                    missing.push(`${requiredQty - currentQty}x ${name}`);
                } else {
                    inventoryUpdates.push({ id: shopItem.id, remove: requiredQty });
                }
            }

            if (missing.length > 0) {
                return interaction.reply({
                    embeds: [errorEmbed(`Matériaux manquants :\n${missing.map(m => `- ${m}`).join('\n')}`)],
                    ephemeral: true
                });
            }

            // Crafting Logic (Transaction)
            let leveledUp = false;
            let newLevel = job.level;
            const xpGain = 100 + (recipe.required_job_level * 20); // Base 100 + bonus

            try {
                db.transaction(() => {
                    // Remove Materials
                    for (const update of inventoryUpdates) {
                        db.run(
                            `UPDATE inventory SET quantity = quantity - ? WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                            [update.remove, userId, guildId, update.id]
                        );
                    }

                    // Add Result
                    const existingResult = db.get(
                        `SELECT quantity FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                        [userId, guildId, recipe.result_id]
                    );

                    if (existingResult) {
                        db.run(
                            `UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?`,
                            [userId, guildId, recipe.result_id]
                        );
                    } else {
                        db.run(
                            `INSERT INTO inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)`,
                            [userId, guildId, recipe.result_id]
                        );
                    }

                    // XP and Level Up
                    let currentXp = job.experience + xpGain;
                    let xpNeeded = newLevel * 100;

                    while (currentXp >= xpNeeded) {
                        currentXp -= xpNeeded;
                        newLevel++;
                        leveledUp = true;
                        xpNeeded = newLevel * 100;
                    }

                    db.run(
                        `UPDATE job_progress SET experience = ?, level = ?, last_worked = ? WHERE user_id = ? AND guild_id = ? AND job_slug = 'artisan'`,
                        [currentXp, newLevel, Math.floor(Date.now() / 1000), userId, guildId]
                    );

                })();
            } catch (error) {
                console.error(error);
                return interaction.reply({
                    embeds: [errorEmbed("Une erreur est survenue lors de la fabrication.")],
                    ephemeral: true
                });
            }

            // Success Message
            const embed = successEmbed(`Vous avez fabriqué **1x ${recipe.result_name}** !`)
                .addFields({ name: 'Expérience', value: `+${xpGain} XP Artisan`, inline: true });

            if (leveledUp) {
                embed.addFields({ name: '🎉 NIVEAU SUPÉRIEUR !', value: `Vous êtes passé au niveau **${newLevel}** !` });
            }

            return interaction.reply({ embeds: [embed] });
        }
    }
};
