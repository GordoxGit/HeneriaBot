const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { sendModerationDM } = require('../../utils/modUtils');
const { parseDuration } = require('../../utils/timeParser');

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

      // 1. Send DM
      const dmResult = await sendModerationDM(targetUser, interaction.guild, type, reason, durationStr);

      // 2. Execute Ban
      await interaction.guild.members.ban(targetUser.id, {
        reason: reason,
        deleteMessageSeconds: deleteMessages ? 7 * 24 * 60 * 60 : 0
      });

      // 3. Log Infraction (DB + Channel)
      const infractionId = createInfraction(interaction.guild, targetUser, interaction.user, type, reason, durationSeconds);
      await logToModChannel(interaction.guild, targetUser, interaction.user, type, reason, durationSeconds, infractionId);

      // 4. Confirm to Moderator
      const confirmMsg = durationSeconds
        ? `✅ **${targetUser.tag}** a été banni temporairement pour ${durationStr}.\nRaison : ${reason}`
        : `✅ **${targetUser.tag}** a été banni définitivement.\nRaison : ${reason}`;

      const dmFeedback = dmResult.sent ? '' : `\n⚠️ ${dmResult.error}`;

      return interaction.editReply({ content: confirmMsg + dmFeedback });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
