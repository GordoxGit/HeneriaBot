const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/modLogger');

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

      // Log Action (DB + DM + Channel)
      await logAction(interaction.guild, targetUser, interaction.user, 'WARN', reason);

      return interaction.editReply({
        content: `⚠️ **${targetUser.tag}** a reçu un avertissement.\nRaison : ${reason}`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
