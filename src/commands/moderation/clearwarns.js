const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { logAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Retirer tous les avertissements d\'un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Nettoyage des avertissements';

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Update DB
      const info = db.run(
        `UPDATE infractions
         SET active = 0
         WHERE guild_id = ? AND user_id = ? AND type = 'WARN' AND active = 1`,
        [interaction.guild.id, targetUser.id]
      );

      if (info.changes === 0) {
        return interaction.editReply({
          content: `✅ Ce membre n'a aucun avertissement actif.`
        });
      }

      // Log Action
      await logAction(interaction.guild, targetUser, interaction.user, 'CLEARWARNS', reason);

      return interaction.editReply({
        content: `✅ **${info.changes}** avertissement(s) ont été retirés pour **${targetUser.tag}**.`
      });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
