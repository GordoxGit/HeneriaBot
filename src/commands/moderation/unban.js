const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { logAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Révoquer le bannissement d\'un utilisateur')
    .addStringOption(option =>
      option.setName('userid')
        .setDescription('L\'ID de l\'utilisateur à débannir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison du débannissement')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    // Validate ID format (simple check)
    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.reply({
        content: 'Format d\'ID utilisateur invalide.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Check if banned
      try {
          await interaction.guild.bans.fetch(userId);
      } catch (e) {
          return interaction.editReply({
              content: 'Cet utilisateur n\'est pas banni du serveur.'
          });
      }

      // Execute Unban
      const user = await interaction.guild.members.unban(userId, reason);

      // Update DB: deactivate any active bans for this user in this guild
      // (This handles previous TEMPBANs or BANs being marked inactive)
      db.run(
        `UPDATE infractions
         SET active = 0
         WHERE guild_id = ? AND user_id = ? AND (type = 'BAN' OR type = 'TEMPBAN') AND active = 1`,
        [interaction.guild.id, userId]
      );

      // Log action
      // We pass the user object returned by unban (which is a User object)
      await logAction(interaction.guild, user, interaction.user, 'UNBAN', reason);

      return interaction.editReply({
        content: `✅ **${user.tag}** a été débanni.\nRaison : ${reason}`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue lors du débannissement : ${error.message}`
      });
    }
  },
};
