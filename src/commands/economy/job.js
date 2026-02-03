const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const path = require('path');
const fs = require('fs');

// Load available jobs for choices
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
                } catch (e) {}
                return null;
            })
            .filter(j => j !== null);
    }
} catch (error) { console.error(error); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('job')
        .setDescription('Administration des métiers')
        .addSubcommandGroup(group =>
            group.setName('admin')
                .setDescription('Commandes administratives')
                .addSubcommand(sub =>
                    sub.setName('add_xp')
                        .setDescription('Ajouter de l\'XP à un joueur')
                        .addUserOption(opt => opt.setName('user').setDescription('Le joueur').setRequired(true))
                        .addStringOption(opt => opt.setName('job').setDescription('Le métier').setRequired(true).addChoices(...availableJobs))
                        .addIntegerOption(opt => opt.setName('amount').setDescription('Montant d\'XP').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('remove_xp')
                        .setDescription('Retirer de l\'XP à un joueur')
                        .addUserOption(opt => opt.setName('user').setDescription('Le joueur').setRequired(true))
                        .addStringOption(opt => opt.setName('job').setDescription('Le métier').setRequired(true).addChoices(...availableJobs))
                        .addIntegerOption(opt => opt.setName('amount').setDescription('Montant d\'XP').setRequired(true)))
                .addSubcommand(sub =>
                    sub.setName('reset')
                        .setDescription('Réinitialiser la progression d\'un joueur')
                        .addUserOption(opt => opt.setName('user').setDescription('Le joueur').setRequired(true))
                        .addStringOption(opt => opt.setName('job').setDescription('Le métier (ou ALL)').setRequired(true).addChoices(...availableJobs, { name: 'TOUS', value: 'ALL' })))),

    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommandGroup !== 'admin') return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [errorEmbed('Permission refusée (Administrator requis).')],
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const jobSlug = interaction.options.getString('job');

        if (subcommand === 'add_xp') {
            const amount = interaction.options.getInteger('amount');
            if (amount <= 0) return interaction.reply({ embeds: [errorEmbed("Le montant doit être positif.")], ephemeral: true });

            let job = db.get(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [targetUser.id, guildId, jobSlug]
            );

            if (!job) {
                // Initialize if not exists
                db.run(
                    `INSERT INTO job_progress (user_id, guild_id, job_slug, level, experience) VALUES (?, ?, ?, 1, 0)`,
                    [targetUser.id, guildId, jobSlug]
                );
                job = { level: 1, experience: 0 };
            }

            let currentXp = job.experience + amount;
            let currentLevel = job.level;
            let xpNeeded = currentLevel * 100;
            let leveledUp = false;

            while (currentXp >= xpNeeded) {
                currentXp -= xpNeeded;
                currentLevel++;
                leveledUp = true;
                xpNeeded = currentLevel * 100;
            }

            db.run(
                `UPDATE job_progress SET experience = ?, level = ? WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [currentXp, currentLevel, targetUser.id, guildId, jobSlug]
            );

            let msg = `✅ Ajouté **${amount} XP** à ${targetUser} pour le métier **${jobSlug}**.\nNiveau: ${job.level} -> ${currentLevel}`;
            if (leveledUp) msg += " 🎉 Level Up!";

            return interaction.reply({ embeds: [successEmbed(msg)] });
        }

        if (subcommand === 'remove_xp') {
             const amount = interaction.options.getInteger('amount');
             if (amount <= 0) return interaction.reply({ embeds: [errorEmbed("Le montant doit être positif.")], ephemeral: true });

             let job = db.get(
                `SELECT * FROM job_progress WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [targetUser.id, guildId, jobSlug]
            );

            if (!job) {
                return interaction.reply({ embeds: [errorEmbed("Ce joueur n'a pas commencé ce métier.")], ephemeral: true });
            }

            let newXp = job.experience - amount;
            if (newXp < 0) newXp = 0; // Prevent de-leveling for simplicity based on prompt "Soit bloquer à 0"

            db.run(
                `UPDATE job_progress SET experience = ? WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                [newXp, targetUser.id, guildId, jobSlug]
            );

            return interaction.reply({ embeds: [successEmbed(`✅ Retiré **${amount} XP** à ${targetUser}.\nNouvel XP: ${newXp} (Niveau inchangé).`)] });
        }

        if (subcommand === 'reset') {
             if (jobSlug === 'ALL') {
                 const confirm = new ButtonBuilder()
                    .setCustomId('confirm_reset')
                    .setLabel('Confirmer RESET TOUT')
                    .setStyle(ButtonStyle.Danger);

                 const row = new ActionRowBuilder().addComponents(confirm);

                 const response = await interaction.reply({
                     content: `⚠️ **ATTENTION** : Vous allez supprimer TOUTE la progression de ${targetUser} dans TOUS les métiers.\nConfirmer ?`,
                     components: [row],
                     fetchReply: true
                 });

                 const filter = i => i.user.id === interaction.user.id;
                 try {
                     const confirmation = await response.awaitMessageComponent({ filter, time: 15000 });
                     if (confirmation.customId === 'confirm_reset') {
                         db.run(`DELETE FROM job_progress WHERE user_id = ? AND guild_id = ?`, [targetUser.id, guildId]);
                         await confirmation.update({ content: `✅ Progression de ${targetUser} entièrement réinitialisée.`, components: [] });
                     }
                 } catch (e) {
                     await interaction.editReply({ content: "Temps écoulé, action annulée.", components: [] });
                 }

             } else {
                 const result = db.run(
                     `UPDATE job_progress SET level = 1, experience = 0, last_worked = 0 WHERE user_id = ? AND guild_id = ? AND job_slug = ?`,
                     [targetUser.id, guildId, jobSlug]
                 );

                 if (result.changes === 0) {
                    return interaction.reply({ embeds: [errorEmbed(`Ce joueur n'a pas de progression dans **${jobSlug}**.`)] });
                 }

                 return interaction.reply({ embeds: [successEmbed(`✅ Métier **${jobSlug}** réinitialisé pour ${targetUser}.`)] });
             }
        }
    }
};
