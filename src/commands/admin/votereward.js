const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('votereward')
        .setDescription('Configurer les récompenses de vote')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Définir les récompenses d\'un site')
                .addStringOption(opt =>
                    opt.setName('site')
                        .setDescription('Site à modifier')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addIntegerOption(opt =>
                    opt.setName('xp')
                        .setDescription('XP par vote')
                        .setMinValue(0)
                        .setMaxValue(1000))
                .addIntegerOption(opt =>
                    opt.setName('money')
                        .setDescription('Monnaie par vote')
                        .setMinValue(0)
                        .setMaxValue(10000)))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Voir les récompenses configurées')),

    async autocomplete(interaction) {
        const sites = db.all(
            'SELECT slug, name FROM vote_sites WHERE guild_id = ?',
            [interaction.guild.id]
        );

        await interaction.respond(
            sites.slice(0, 25).map(s => ({ name: s.name, value: s.slug }))
        );
    },

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const slug = interaction.options.getString('site');
            const xp = interaction.options.getInteger('xp');
            const money = interaction.options.getInteger('money');

            const site = db.get(
                'SELECT * FROM vote_sites WHERE guild_id = ? AND slug = ?',
                [guildId, slug]
            );

            if (!site) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(COLORS.ERROR)
                        .setDescription('❌ Site introuvable.')
                    ],
                    ephemeral: true
                });
            }

            // Mettre à jour les récompenses
            const updates = [];
            const values = [];

            if (xp !== null) {
                updates.push('reward_xp = ?');
                values.push(xp);
            }
            if (money !== null) {
                updates.push('reward_money = ?');
                values.push(money);
            }

            if (updates.length > 0) {
                values.push(guildId, slug);
                db.run(`
                    UPDATE vote_sites SET ${updates.join(', ')}
                    WHERE guild_id = ? AND slug = ?
                `, values);
            }

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.SUCCESS)
                    .setTitle('✅ Récompenses mises à jour')
                    .setDescription(`**${site.name}**\nXP: ${xp ?? site.reward_xp}\nMonnaie: ${money ?? site.reward_money}`)
                ],
                ephemeral: true
            });

        } else if (subcommand === 'view') {
            const sites = db.all(`
                SELECT name, reward_xp, reward_money FROM vote_sites
                WHERE guild_id = ? ORDER BY position
            `, [guildId]);

            const embed = new EmbedBuilder()
                .setColor(COLORS.PRIMARY)
                .setTitle('💰 Récompenses de vote')
                .setDescription(sites.length === 0
                    ? 'Aucun site configuré.'
                    : sites.map(s => `**${s.name}**\n└ ${s.reward_xp} XP + ${s.reward_money} 💰`).join('\n\n')
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
