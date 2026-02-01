const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à expulser')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison de l\'expulsion')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: 'Cet utilisateur n\'est pas sur le serveur.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (member.id === interaction.user.id) {
        return interaction.reply({
            content: 'Vous ne pouvez pas vous expulser vous-même.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Check hierarchy: Mod > Target
    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({
        content: 'Vous ne pouvez pas expulser ce membre car il possède un rôle supérieur ou égal au vôtre.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check hierarchy: Bot > Target
    if (!member.kickable) {
       return interaction.reply({
        content: 'Je ne peux pas expulser ce membre. Mon rôle est peut-être inférieur au sien.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Log (includes DM)
      await logAction(interaction.guild, targetUser, interaction.user, 'KICK', reason);

      // Execute Kick
      await member.kick(reason);

      return interaction.editReply({
        content: `✅ **${targetUser.tag}** a été expulsé.\nRaison : ${reason}`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
