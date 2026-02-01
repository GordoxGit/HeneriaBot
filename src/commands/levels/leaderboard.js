const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement du serveur'),

  async execute(interaction) {
    const guildId = interaction.guild.id;

    // Récupérer les données
    try {
      const users = db.all(
        'SELECT * FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC',
        [guildId]
      );

      if (users.length === 0) {
        return interaction.reply({
          content: 'Aucune donnée de niveau disponible pour ce serveur.',
          ephemeral: true
        });
      }

      const itemsPerPage = 10;
      const totalPages = Math.ceil(users.length / itemsPerPage);
      let currentPage = 0;

      const generateEmbed = async (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const currentUsers = users.slice(start, end);

        const embed = new EmbedBuilder()
          .setColor(COLORS.PRIMARY)
          .setTitle(`🏆 Classement - ${interaction.guild.name}`)
          .setFooter({ text: `Page ${page + 1}/${totalPages} • Top ${users.length} membres` });

        let description = '';

        // Fetch users in parallel if possible, but keep order
        // For simplicity and avoiding rate limits, we'll do sequential or simple cache lookup
        for (let i = 0; i < currentUsers.length; i++) {
          const userData = currentUsers[i];
          const rank = start + i + 1;

          let username = 'Utilisateur inconnu';
          try {
             // Try to get from cache first
             let member = interaction.guild.members.cache.get(userData.user_id);
             if (!member) {
                // If not in cache, fetch (can be slow for many users, but paginated is 10)
                member = await interaction.guild.members.fetch(userData.user_id);
             }
             username = member.user.username;
          } catch (e) {
             // User left or error
             username = `Utilisateur parti (${userData.user_id})`;
          }

          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

          description += `**${medal} ${username}**\nLevel ${userData.level} (${userData.xp.toLocaleString()} XP)\n\n`;
        }

        embed.setDescription(description);
        return embed;
      };

      const generateButtons = (page) => {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Précédent')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Suivant')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1)
          );
        return row;
      };

      // Initial response
      await interaction.deferReply();
      const initialEmbed = await generateEmbed(currentPage);
      const initialButtons = generateButtons(currentPage);

      const response = await interaction.editReply({
        embeds: [initialEmbed],
        components: [initialButtons]
      });

      // Collector
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'Vous ne pouvez pas utiliser ces boutons.', ephemeral: true });
        }

        if (i.customId === 'prev') {
          currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId === 'next') {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        }

        await i.deferUpdate();
        const newEmbed = await generateEmbed(currentPage);
        const newButtons = generateButtons(currentPage);

        await i.editReply({
          embeds: [newEmbed],
          components: [newButtons]
        });
      });

      collector.on('end', () => {
         const disabledButtons = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Précédent')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Suivant')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

         interaction.editReply({ components: [disabledButtons] }).catch(() => {});
      });

    } catch (error) {
      logger.error(`Erreur leaderboard: ${error.message}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Une erreur est survenue lors de l\'affichage du classement.', ephemeral: true });
      } else {
        await interaction.editReply({ content: 'Une erreur est survenue lors de l\'affichage du classement.' });
      }
    }
  }
};
