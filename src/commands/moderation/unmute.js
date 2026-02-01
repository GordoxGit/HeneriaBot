const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { logAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Révoquer le mute (Timeout) d\'un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à unmute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (member) {
          // Remove Timeout
          await member.timeout(null, reason);
      }

      // Update DB: deactivate active MUTES for this user
      db.run(
        `UPDATE infractions
         SET active = 0
         WHERE guild_id = ? AND user_id = ? AND type = 'MUTE' AND active = 1`,
        [interaction.guild.id, targetUser.id]
      );

      // Log action
      await logAction(interaction.guild, targetUser, interaction.user, 'UNMUTE', reason);

      let content = `✅ **${targetUser.tag}** a été unmute.\nRaison : ${reason}`;
      if (!member) {
          content += `\n(L'utilisateur n'est plus sur le serveur, mais l'infraction a été clôturée en base de données)`;
      }

      return interaction.editReply({ content });

    } catch (error) {
      return interaction.editReply({
        content: `❌ Une erreur est survenue : ${error.message}`
      });
    }
  },
};
