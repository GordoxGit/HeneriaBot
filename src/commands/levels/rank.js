/**
 * Commande /rank
 * Affiche le niveau, l'XP et le rang d'un utilisateur avec une carte visuelle
 */

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const levelSystem = require('../../utils/levelSystem');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Affiche votre niveau et votre progression XP')
    .addUserOption(option =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir le rang (par défaut: vous-même)')
        .setRequired(false)
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const guildId = interaction.guild.id;

      // Récupérer les données de l'utilisateur
      const userData = levelSystem.getUserLevel(targetUser.id, guildId);
      const rank = levelSystem.getUserRank(targetUser.id, guildId);
      const progress = levelSystem.getProgressToNextLevel(userData.xp, userData.level);

      // Générer la rank card
      const attachment = await generateRankCard(
        targetUser,
        userData,
        rank,
        progress
      );

      await interaction.editReply({
        files: [attachment]
      });

    } catch (error) {
      console.error('[Rank Command] Erreur:', error);
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la génération de votre carte de rang.',
        ephemeral: true
      });
    }
  },
};

/**
 * Génère une image de carte de rang avec Canvas
 * @param {import('discord.js').User} user - L'utilisateur Discord
 * @param {Object} userData - Les données de niveau de l'utilisateur
 * @param {number} rank - Le rang de l'utilisateur
 * @param {Object} progress - Les informations de progression
 * @returns {Promise<AttachmentBuilder>} L'image générée
 */
async function generateRankCard(user, userData, rank, progress) {
  // Dimensions de la carte
  const width = 934;
  const height = 282;

  // Créer le canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // === ARRIÈRE-PLAN ===
  // Dégradé de fond avec les couleurs Heneria
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, COLORS.SECONDARY); // #1D0342 - Bleu nuit
  gradient.addColorStop(1, COLORS.PRIMARY);   // #780CED - Violet Heneria
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  // Overlay semi-transparent pour effet de profondeur
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  // === AVATAR ===
  const avatarSize = 180;
  const avatarX = 40;
  const avatarY = (height - avatarSize) / 2;

  // Cercle de fond pour l'avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = COLORS.PRIMARY;
  ctx.fill();
  ctx.restore();

  // Charger et dessiner l'avatar
  try {
    const avatar = await loadImage(
      user.displayAvatarURL({ extension: 'png', size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (error) {
    // Si l'avatar ne charge pas, dessiner un cercle de couleur
    ctx.fillStyle = COLORS.INFO;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === TEXTE ===
  const textX = avatarX + avatarSize + 40;

  // Nom d'utilisateur
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(user.username, textX, 70);

  // Rang
  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = COLORS.WARNING;
  const rankText = `#${rank}`;
  const rankWidth = ctx.measureText(rankText).width;
  ctx.fillText(rankText, width - rankWidth - 40, 70);

  // Niveau
  ctx.font = 'bold 32px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`Niveau ${userData.level}`, textX, 120);

  // XP Text
  ctx.font = '24px Arial';
  ctx.fillStyle = '#B0B0B0';
  const xpText = `${progress.currentXP} / ${progress.requiredXP} XP`;
  ctx.fillText(xpText, textX, 160);

  // === BARRE DE PROGRESSION ===
  const barX = textX;
  const barY = 190;
  const barWidth = width - textX - 40;
  const barHeight = 40;
  const barRadius = 20;

  // Fond de la barre
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
  ctx.fill();

  // Barre de progression (remplie)
  const progressWidth = (barWidth * progress.percentage) / 100;
  if (progressWidth > 0) {
    const progressGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    progressGradient.addColorStop(0, COLORS.SUCCESS);
    progressGradient.addColorStop(1, COLORS.PRIMARY);
    ctx.fillStyle = progressGradient;
    roundRect(ctx, barX, barY, progressWidth, barHeight, barRadius);
    ctx.fill();
  }

  // Pourcentage sur la barre
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(`${progress.percentage}%`, barX + barWidth / 2, barY + 26);

  // Total de messages
  ctx.textAlign = 'left';
  ctx.font = '18px Arial';
  ctx.fillStyle = '#B0B0B0';
  ctx.fillText(`📨 ${userData.total_messages} messages`, textX, barY + barHeight + 25);

  // Convertir le canvas en buffer
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'rank-card.png' });
}

/**
 * Dessine un rectangle arrondi
 * @param {CanvasRenderingContext2D} ctx - Contexte du canvas
 * @param {number} x - Position X
 * @param {number} y - Position Y
 * @param {number} width - Largeur
 * @param {number} height - Hauteur
 * @param {number} radius - Rayon des coins
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
