const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { sendSanctionEndedDM } = require('../../utils/modUtils');
const { COLORS } = require('../../config/constants');

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

    if (!/^\d{17,19}$/.test(userId)) {
      return interaction.reply({
        content: 'Format d\'ID utilisateur invalide.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
          await interaction.guild.bans.fetch(userId);
      } catch (e) {
          return interaction.editReply({
              content: 'Cet utilisateur n\'est pas banni du serveur.'
          });
      }

      let user = await interaction.client.users.fetch(userId).catch(() => null);

      if (user) {
          await sendSanctionEndedDM(user, interaction.guild, 'BAN');
      }

      const unbannedUser = await interaction.guild.members.unban(userId, reason);
      if (!user) user = unbannedUser;

      db.run(
        `UPDATE infractions
         SET active = 0
         WHERE guild_id = ? AND user_id = ? AND (type = 'BAN' OR type = 'TEMPBAN') AND active = 1`,
        [interaction.guild.id, userId]
      );

      const infractionId = createInfraction(interaction.guild, user, interaction.user, 'UNBAN', reason);
      await logToModChannel(interaction.guild, user, interaction.user, 'UNBAN', reason, null, infractionId);

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
