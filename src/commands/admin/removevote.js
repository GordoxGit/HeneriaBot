const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removevote')
        .setDescription('Supprimer un site de vote')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('slug')
                .setDescription('Identifiant du site à supprimer')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const sites = db.all(
            'SELECT slug, name FROM vote_sites WHERE guild_id = ?',
            [interaction.guild.id]
        );

        const filtered = sites.filter(s =>
            s.slug.includes(focusedValue.toLowerCase()) ||
            s.name.toLowerCase().includes(focusedValue.toLowerCase())
        );

        await interaction.respond(
            filtered.slice(0, 25).map(s => ({ name: `${s.name} (${s.slug})`, value: s.slug }))
        );
    },

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const slug = interaction.options.getString('slug');

        const site = db.get(
            'SELECT * FROM vote_sites WHERE guild_id = ? AND slug = ?',
            [guildId, slug]
        );

        if (!site) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setDescription(`❌ Site \`${slug}\` introuvable.`)
                ],
                ephemeral: true
            });
        }

        // Supprimer le site
        db.run('DELETE FROM vote_sites WHERE guild_id = ? AND slug = ?', [guildId, slug]);

        // Reload polling
        const voteHandler = require('../../handlers/voteHandler');
        voteHandler.reloadPolling();

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setDescription(`✅ Site **${site.name}** supprimé avec succès.`)
            ],
            ephemeral: true
        });
    }
};
