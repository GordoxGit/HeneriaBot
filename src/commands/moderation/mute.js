const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { sendModerationDM } = require('../../utils/modUtils');
const { parseDuration } = require('../../utils/timeParser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute un membre temporairement (Timeout)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à mute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Durée (ex: 10m, 1h, 1d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison du mute')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    // Parse duration
    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
      return interaction.reply({
        content: 'Format de durée invalide. Utilisez le format nombre+unité (ex: 10m, 1h, 1d).',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check Max Duration (28 days = 2419200 seconds)
    if (durationSeconds > 28 * 24 * 60 * 60) {
      return interaction.reply({
        content: 'La durée ne peut pas dépasser 28 jours (limite Discord).',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: 'Cet utilisateur n\'est pas sur le serveur.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (member.id === interaction.user.id) {
        return interaction.reply({
            content: 'Vous ne pouvez pas vous mute vous-même.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Hierarchy Check
    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: 'Vous ne pouvez pas mute ce membre car il possède un rôle supérieur ou égal au vôtre.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!member.moderatable) {
       return interaction.reply({
        content: 'Je ne peux pas mute ce membre. Mon rôle est peut-être inférieur au sien.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Apply Timeout
      await member.timeout(durationSeconds * 1000, reason);

      const dmResult = await sendModerationDM(targetUser, interaction.guild, 'MUTE', reason, durationStr);

      const infractionId = createInfraction(interaction.guild, targetUser, interaction.user, 'MUTE', reason, durationSeconds);
      await logToModChannel(interaction.guild, targetUser, interaction.user, 'MUTE', reason, durationSeconds, infractionId);

      const dmFeedback = dmResult.sent ? '' : `\n⚠️ ${dmResult.error}`;

      return interaction.editReply({
        content: `✅ **${targetUser.tag}** a été mute pour ${durationStr}.\nRaison : ${reason}${dmFeedback}`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
