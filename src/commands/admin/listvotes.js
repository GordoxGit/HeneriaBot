const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listvotes')
        .setDescription('Afficher tous les sites de vote configurés'),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        const sites = db.all(`
            SELECT * FROM vote_sites WHERE guild_id = ? ORDER BY position ASC
        `, [guildId]);

        if (sites.length === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.WARNING)
                    .setDescription('⚠️ Aucun site de vote configuré.')
                ],
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('📋 Sites de vote configurés')
            .setDescription(sites.map((s, i) => {
                const status = s.enabled ? '🟢' : '🔴';
                const apiType = {
                    'webhook': '🔗 Webhook',
                    'polling_otp': '🔄 OTP',
                    'polling_check': '🔄 Check'
                }[s.api_type] || s.api_type;

                return `${status} **${i + 1}. ${s.name}** (\`${s.slug}\`)\n` +
                       `   └ ${apiType} • ${s.reward_xp} XP + ${s.reward_money} 💰`;
            }).join('\n\n'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
