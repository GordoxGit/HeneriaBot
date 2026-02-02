const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Gérer les rôles d\'un membre')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter un rôle à un membre')
        .addUserOption(option => option.setName('user').setDescription('Le membre').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('Le rôle à ajouter').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retirer un rôle à un membre')
        .addUserOption(option => option.setName('user').setDescription('Le membre').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('Le rôle à retirer').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        content: '❌ Impossible de trouver ce membre sur le serveur.',
        flags: MessageFlags.Ephemeral
      });
    }

    const botMember = interaction.guild.members.me;

    // Check if Bot can manage this role
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ Je ne peux pas gérer le rôle **${role.name}** car il est supérieur ou égal à mon rôle le plus élevé.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if Executor can manage this role
    if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({
            content: `❌ Vous ne pouvez pas gérer le rôle **${role.name}** car il est supérieur ou égal à votre rôle le plus élevé.`,
            flags: MessageFlags.Ephemeral
        });
    }

    try {
      if (subcommand === 'add') {
        if (member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `⚠️ **${targetUser.tag}** possède déjà le rôle **${role.name}**.`,
            flags: MessageFlags.Ephemeral
          });
        }
        await member.roles.add(role);
        return interaction.reply({
          content: `✅ Le rôle **${role.name}** a été ajouté à **${targetUser.tag}**.`
        });
      } else if (subcommand === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `⚠️ **${targetUser.tag}** ne possède pas le rôle **${role.name}**.`,
            flags: MessageFlags.Ephemeral
          });
        }
        await member.roles.remove(role);
        return interaction.reply({
          content: `✅ Le rôle **${role.name}** a été retiré de **${targetUser.tag}**.`
        });
      }
    } catch (error) {
      return interaction.reply({
        content: `❌ Une erreur est survenue : ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
