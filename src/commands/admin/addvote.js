const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addvote')
        .setDescription('Ajouter un site de vote')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom d\'affichage du site')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('slug')
                .setDescription('Identifiant unique (ex: hytale-game)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('url')
                .setDescription('URL de la page de vote')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('api_type')
                .setDescription('Type de détection des votes')
                .setRequired(true)
                .addChoices(
                    { name: 'Webhook Discord', value: 'webhook' },
                    { name: 'Polling OTP', value: 'polling_otp' },
                    { name: 'Polling Check', value: 'polling_check' }
                ))
        .addStringOption(option =>
            option.setName('api_token')
                .setDescription('Token/clé API'))
        .addStringOption(option =>
            option.setName('api_base_url')
                .setDescription('URL de base de l\'API'))
        .addIntegerOption(option =>
            option.setName('reward_xp')
                .setDescription('XP par vote (défaut: 50)')
                .setMinValue(0)
                .setMaxValue(1000))
        .addIntegerOption(option =>
            option.setName('reward_money')
                .setDescription('Monnaie par vote (défaut: 100)')
                .setMinValue(0)
                .setMaxValue(10000)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const nom = interaction.options.getString('nom');
        const slug = interaction.options.getString('slug').toLowerCase().replace(/\s+/g, '-');
        const url = interaction.options.getString('url');
        const apiType = interaction.options.getString('api_type');
        const apiToken = interaction.options.getString('api_token');
        const apiBaseUrl = interaction.options.getString('api_base_url');
        const rewardXp = interaction.options.getInteger('reward_xp') ?? 50;
        const rewardMoney = interaction.options.getInteger('reward_money') ?? 100;

        // Vérifier si le slug existe déjà
        const existing = db.get(
            'SELECT id FROM vote_sites WHERE guild_id = ? AND slug = ?',
            [guildId, slug]
        );

        if (existing) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setDescription(`❌ Un site avec le slug \`${slug}\` existe déjà.`)
                ],
                ephemeral: true
            });
        }

        // Obtenir la position max
        const maxPos = db.get(
            'SELECT MAX(position) as max FROM vote_sites WHERE guild_id = ?',
            [guildId]
        );

        // Insérer le nouveau site
        db.run(`
            INSERT INTO vote_sites (guild_id, name, slug, url, api_type, api_token, api_base_url, reward_xp, reward_money, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [guildId, nom, slug, url, apiType, apiToken, apiBaseUrl, rewardXp, rewardMoney, (maxPos?.max || 0) + 1]);

        // Reload polling
        const voteHandler = require('../../handlers/voteHandler');
        voteHandler.reloadPolling();

        const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✅ Site de vote ajouté')
            .addFields(
                { name: 'Nom', value: nom, inline: true },
                { name: 'Slug', value: slug, inline: true },
                { name: 'Type', value: apiType, inline: true },
                { name: 'URL', value: url },
                { name: 'Récompenses', value: `${rewardXp} XP + ${rewardMoney} 💰`, inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
