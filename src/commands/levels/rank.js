const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');
const db = require('../../database/db');
const levelSystem = require('../../utils/levelSystem');
const { COLORS } = require('../../config/constants');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Affiche la carte de niveau d\'un utilisateur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur dont vous voulez voir le rang')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guild.id;

      // Récupérer les données de l'utilisateur
      const userData = db.get(
        'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
        [targetUser.id, guildId]
      );

      // Si pas de données
      if (!userData) {
        return interaction.editReply({
          content: targetUser.id === interaction.user.id
            ? "❌ Tu n'as pas encore gagné d'expérience sur ce serveur !"
            : `❌ **${targetUser.username}** n'a pas encore gagné d'expérience !`
        });
      }

      // Calcul du rang
      const rankQuery = db.get(
        'SELECT COUNT(*) as count FROM user_levels WHERE guild_id = ? AND xp > ?',
        [guildId, userData.xp]
      );
      const rank = rankQuery.count + 1;

      // Calcul de la progression
      const progress = levelSystem.calculateLevelProgress(userData.xp);

      // --- GÉNÉRATION CANVAS ---
      const width = 934;
      const height = 282;
      const canvas = Canvas.createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Fond global
      ctx.fillStyle = '#23272A'; // Gris très foncé Discord
      ctx.fillRect(0, 0, width, height);

      // Rectangle arrondi de fond (simulation simple)
      ctx.fillStyle = COLORS.SECONDARY; // Bleu nuit Heneria
      ctx.fillRect(10, 10, width - 20, height - 20);

      // Masque pour l'avatar circulaire
      const avatarSize = 180;
      const avatarX = 50;
      const avatarY = (height - avatarSize) / 2;

      try {
        const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Canvas.loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Bordure avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.lineWidth = 6;
        ctx.strokeStyle = COLORS.PRIMARY;
        ctx.stroke();
      } catch (e) {
        logger.warn(`Erreur chargement avatar rank: ${e.message}`);
      }

      // Positions
      const textX = 270;

      // Username
      ctx.font = 'bold 40px "Sans Serif", "Arial"';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(targetUser.username, textX, 80);

      // Stats (Level & Rank)
      ctx.font = '30px "Sans Serif", "Arial"';
      ctx.textAlign = 'right';
      const statsY = 80;

      // Rang
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('RANG', width - 160, statsY);
      ctx.font = 'bold 50px "Sans Serif", "Arial"';
      ctx.fillStyle = COLORS.PRIMARY; // Heneria Primary
      ctx.fillText(`#${rank}`, width - 50, statsY);

      // Niveau (juste à gauche du rang, mais ajusté)
      // On reset l'alignement pour faciliter le placement relatif si besoin,
      // mais ici on va placer le niveau sous le pseudo ou à côté

      ctx.font = '30px "Sans Serif", "Arial"';
      ctx.fillStyle = COLORS.PRIMARY;
      ctx.textAlign = 'left';
      ctx.fillText(`Niveau ${progress.level}`, textX, 130);

      ctx.fillStyle = '#AAAAAA';
      ctx.font = '24px "Sans Serif", "Arial"';
      ctx.textAlign = 'right';
      ctx.fillText(`${progress.currentLevelXp} / ${progress.xpToNextLevel} XP`, width - 50, 130);

      // Barre de progression
      const barX = textX;
      const barY = 160;
      const barWidth = width - barX - 50;
      const barHeight = 40;

      // Fond de barre
      ctx.fillStyle = '#484B4E';
      ctx.beginPath();
      // rounded rect simulé
      ctx.roundRect ? ctx.roundRect(barX, barY, barWidth, barHeight, 20) : ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fill();

      // Remplissage
      if (progress.progressPercent > 0) {
        const fillWidth = Math.max(barHeight, (progress.progressPercent / 100) * barWidth); // Au moins un cercle si > 0
        ctx.fillStyle = COLORS.SUCCESS; // Vert pour la progression
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(barX, barY, fillWidth, barHeight, 20) : ctx.fillRect(barX, barY, fillWidth, barHeight);
        ctx.fill();
      }

      // Envoi
      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });
      await interaction.editReply({ files: [attachment] });

    } catch (error) {
      logger.error(`Erreur commande rank: ${error.message}`);
      // Si déjà déféré, on ne peut plus reply, il faut edit
      if (interaction.deferred) {
        await interaction.editReply({ content: 'Une erreur est survenue lors de la génération de la carte.' });
      } else {
        await interaction.reply({ content: 'Une erreur est survenue.', flags: 64 }); // Ephemeral via flag
      }
    }
  },
};
