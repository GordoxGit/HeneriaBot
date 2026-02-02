const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { parseDuration } = require('../../utils/timeParser');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Définir le mode lent du salon.')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Durée du mode lent (ex: 10s, 1m, 1h). Mettre 0 pour désactiver.')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const durationStr = interaction.options.getString('duration');
    let seconds;

    if (durationStr === '0' || durationStr.toLowerCase() === 'off') {
        seconds = 0;
    } else {
        // If strict number, assume seconds
        if (/^\d+$/.test(durationStr)) {
            seconds = parseInt(durationStr, 10);
        } else {
            seconds = parseDuration(durationStr);
        }
    }

    if (seconds === null || isNaN(seconds)) {
        return interaction.reply({
            content: '❌ Format invalide. Utilisez un nombre (secondes) ou un format type "10s", "1m", "1h".',
            flags: MessageFlags.Ephemeral
        });
    }

    if (seconds > 21600) { // Discord limit is 6 hours
         return interaction.reply({
            content: '❌ La durée maximale du mode lent est de 6 heures (21600s).',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        await interaction.channel.setRateLimitPerUser(seconds);

        const description = seconds === 0
            ? 'Mode lent désactivé.'
            : `Mode lent défini sur ${seconds} secondes.`;

        await logGeneralAction(interaction.guild, interaction.user, 'SLOWMODE', description, interaction.channel);

        await interaction.reply({
            content: `✅ ${description}`,
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: `❌ Erreur : ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
  }
};
