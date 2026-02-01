const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à bannir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison du bannissement')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Durée (ex: 1d, 2h). Laisser vide pour un ban définitif.')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('delete_messages')
        .setDescription('Supprimer les messages des 7 derniers jours ?')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';
    const durationStr = interaction.options.getString('duration');
    const deleteMessages = interaction.options.getBoolean('delete_messages') || false;

    // Parse duration
    let durationSeconds = null;
    if (durationStr) {
      durationSeconds = parseDuration(durationStr);
      if (!durationSeconds) {
        return interaction.reply({
          content: 'Format de durée invalide. Utilisez le format nombre+unité (ex: 1d, 2h, 30m, 60s).',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    const type = durationSeconds ? 'TEMPBAN' : 'BAN';

    // Attempt to fetch member to check hierarchy
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: 'Vous ne pouvez pas vous bannir vous-même.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check hierarchy: Mod > Target
        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                content: 'Vous ne pouvez pas bannir ce membre car il possède un rôle supérieur ou égal au vôtre.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check hierarchy: Bot > Target
        if (!member.bannable) {
             return interaction.reply({
                content: 'Je ne peux pas bannir ce membre. Mon rôle est peut-être inférieur au sien.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Log (includes DM)
      await logAction(interaction.guild, targetUser, interaction.user, type, reason, durationSeconds);

      // Execute Ban
      await interaction.guild.members.ban(targetUser.id, {
        reason: reason,
        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0
      });

      const confirmMsg = durationSeconds
        ? `✅ **${targetUser.tag}** a été banni temporairement pour ${durationStr}.\nRaison : ${reason}`
        : `✅ **${targetUser.tag}** a été banni définitivement.\nRaison : ${reason}`;

      return interaction.editReply({ content: confirmMsg });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};

function parseDuration(str) {
  if (!str) return null;
  const regex = /^(\d+)([smhd])$/i; // case insensitive
  const match = str.match(regex);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch(unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return null;
  }
}
