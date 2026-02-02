const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { sendModerationDM } = require('../../utils/modUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Donner un avertissement à un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à avertir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison de l\'avertissement')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: 'Vous ne pouvez pas vous avertir vous-même.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Hierarchy Check
        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                content: 'Vous ne pouvez pas avertir ce membre car il possède un rôle supérieur ou égal au vôtre.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const dmResult = await sendModerationDM(targetUser, interaction.guild, 'WARN', reason);

      const infractionId = createInfraction(interaction.guild, targetUser, interaction.user, 'WARN', reason);
      await logToModChannel(interaction.guild, targetUser, interaction.user, 'WARN', reason, null, infractionId);

      const dmFeedback = dmResult.sent ? '' : `\n⚠️ ${dmResult.error}`;

      return interaction.editReply({
        content: `⚠️ **${targetUser.tag}** a reçu un avertissement.\nRaison : ${reason}${dmFeedback}`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
