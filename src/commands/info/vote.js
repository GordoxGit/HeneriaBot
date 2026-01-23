const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const voteHandler = require('../../handlers/voteHandler');
const { COLORS } = require('../../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Affiche les sites de vote pour soutenir le serveur'),

    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // Récupérer les sites actifs
        const sites = db.all(`
            SELECT * FROM vote_sites
            WHERE guild_id = ? AND enabled = 1
            ORDER BY position ASC
        `, [guildId]);

        if (sites.length === 0) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.WARNING)
                    .setDescription('⚠️ Aucun site de vote n\'est configuré.')
                ]
            });
        }

        // Récupérer les stats de l'utilisateur
        const userStats = db.get(`
            SELECT * FROM vote_stats WHERE user_id = ? AND guild_id = ?
        `, [userId, guildId]);

        // Récupérer les cooldowns actifs
        const cooldowns = await voteHandler.getUserCooldowns(userId, guildId);

        // Construire la liste des sites avec statut
        let sitesDescription = '';
        const buttons = [];

        for (const site of sites) {
            const cooldownInfo = cooldowns[site.slug];
            const canVote = !cooldownInfo || cooldownInfo.canVote;
            const statusEmoji = canVote ? '✅' : '⏳';
            const cooldownText = canVote ? 'Disponible' : `<t:${cooldownInfo.nextVoteAt}:R>`;

            sitesDescription += `${statusEmoji} **${site.name}**\n`;
            sitesDescription += `   └ ${cooldownText} • +${site.reward_xp} XP, +${site.reward_money} 💰\n\n`;

            // Générer l'URL personnalisée
            let voteUrl = site.url;

            if (site.slug === 'serveur-prive') {
                // Générer OTP pour serveur-prive.net
                const otp = await voteHandler.generateOTP(userId, guildId, site.slug);
                if (otp) {
                    voteUrl = `${site.url}?token=${otp}`;
                }
            } else if (site.slug === 'hytale-servs') {
                // Ajouter Discord ID pour hytale-servs.fr
                voteUrl = `${site.url}?pid=${userId}`;
            }

            buttons.push(
                new ButtonBuilder()
                    .setLabel(site.name)
                    .setURL(voteUrl)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji(canVote ? '🗳️' : '⏳')
            );
        }

        // Créer l'embed principal
        const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY)
            .setTitle('🗳️ Voter pour Heneria')
            .setDescription(`Soutenez le serveur en votant sur les sites ci-dessous !\n\n**Pourquoi voter ?**\n• Aide le serveur à gagner en visibilité\n• Récompenses exclusives à chaque vote\n• C'est gratuit et rapide !\n\n**Sites de vote**\n${sitesDescription}`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({ text: `Streak actuel : ${userStats?.current_streak || 0} jours • Total : ${userStats?.total_votes || 0} votes` });

        // Créer les rows de boutons (max 5 par row)
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        await interaction.editReply({ embeds: [embed], components: rows });
    }
};
