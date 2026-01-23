const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setvotechannel')
        .setDescription('Définir le salon pour les messages de remerciement des votes')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Salon pour les notifications de vote')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const channel = interaction.options.getChannel('salon');

        // Sauvegarder dans les settings
        db.run(`
            INSERT INTO settings (guild_id, key, value)
            VALUES (?, 'vote_channel_id', ?)
            ON CONFLICT(guild_id, key) DO UPDATE SET value = ?
        `, [guildId, channel.id, channel.id]);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setDescription(`✅ Les notifications de vote seront envoyées dans ${channel}.`)
            ],
            ephemeral: true
        });
    }
};
