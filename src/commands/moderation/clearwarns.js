const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { COLORS } = require('../../config/constants');

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

      // Notification DM
      try {
        const dmEmbed = new EmbedBuilder()
            .setTitle('Sanction levée / Pardonnée')
            .setDescription(`Vos avertissements ont été retirés sur **${interaction.guild.name}**.`)
            .setColor(COLORS.SUCCESS);
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (err) {
        // Ignorer si les MP sont fermés
      }

      const infractionId = createInfraction(interaction.guild, targetUser, interaction.user, 'CLEARWARNS', reason);
      await logToModChannel(interaction.guild, targetUser, interaction.user, 'CLEARWARNS', reason, null, infractionId);

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
