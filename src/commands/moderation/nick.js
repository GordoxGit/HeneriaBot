const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Modifier le pseudo d\'un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre dont le pseudo doit être modifié')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('pseudo')
        .setDescription('Le nouveau pseudo (max 32 caractères)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const newNickname = interaction.options.getString('pseudo');

    if (newNickname.length > 32) {
      return interaction.reply({
        content: '❌ Le pseudo ne doit pas dépasser 32 caractères.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Impossible de trouver ce membre sur le serveur.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Hierarchy Check (Bot vs Target)
    const botMember = interaction.guild.members.me;
    if (member.roles.highest.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: '❌ Je ne peux pas modifier le pseudo de ce membre car il possède un rôle supérieur ou égal au mien.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Hierarchy Check (Executor vs Target) - Standard practice, though permission check covers most
    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({
            content: '❌ Vous ne pouvez pas modifier le pseudo de ce membre car il est supérieur ou égal à vous.',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
      await member.setNickname(newNickname);
      return interaction.reply({
        content: `✅ Le pseudo de **${targetUser.tag}** a été changé en **${newNickname}**.`
      });
    } catch (error) {
      return interaction.reply({
        content: `❌ Une erreur est survenue lors de la modification du pseudo : ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
