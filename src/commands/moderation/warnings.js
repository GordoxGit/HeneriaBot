const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Voir les avertissements d\'un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');

    try {
      // Get active warnings
      const warnings = db.all(
        `SELECT * FROM infractions
         WHERE guild_id = ? AND user_id = ? AND type = 'WARN' AND active = 1
         ORDER BY created_at DESC`,
        [interaction.guild.id, targetUser.id]
      );

      const embed = new EmbedBuilder()
        .setTitle(`Avertissements pour ${targetUser.tag}`)
        .setColor(COLORS.WARNING)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `${warnings.length} avertissement(s) actif(s)` });

      if (warnings.length === 0) {
        embed.setDescription('✅ Aucun avertissement actif.');
        embed.setColor(COLORS.SUCCESS);
      } else {
        const description = warnings.map(w => {
           const date = `<t:${w.created_at}:d>`;
           return `**ID #${w.id}** - ${date}\nRaison : ${w.reason}\nModérateur : <@${w.moderator_id}>`;
        }).join('\n\n');

        if (description.length > 4096) {
             embed.setDescription(description.substring(0, 4093) + '...');
        } else {
             embed.setDescription(description);
        }
      }

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      return interaction.reply({
        content: `❌ Une erreur est survenue : ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
