const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createInfraction, logToModChannel } = require('../../utils/modLogger');
const { sendModerationDM } = require('../../utils/modUtils');
const db = require('../../database/db');
const { parseDuration } = require('../../utils/timeParser');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Donner un avertissement à un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre à avertir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('La raison de l\'avertissement')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: 'Vous ne pouvez pas vous avertir vous-même.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Hierarchy Check
        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                content: 'Vous ne pouvez pas avertir ce membre car il possède un rôle supérieur ou égal au vôtre.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // 1. Send Warn DM
      const dmResult = await sendModerationDM(targetUser, interaction.guild, 'WARN', reason);

      // 2. Log Warn
      const infractionId = createInfraction(interaction.guild, targetUser, interaction.user, 'WARN', reason);
      await logToModChannel(interaction.guild, targetUser, interaction.user, 'WARN', reason, null, infractionId);

      const dmFeedback = dmResult.sent ? '' : `\n⚠️ ${dmResult.error}`;

      await interaction.editReply({
        content: `⚠️ **${targetUser.tag}** a reçu un avertissement.\nRaison : ${reason}${dmFeedback}`
      });

      // 3. Auto-Actions Logic
      const warns = db.get('SELECT count(*) as count FROM infractions WHERE guild_id = ? AND user_id = ? AND type = ? AND active = 1', [interaction.guild.id, targetUser.id, 'WARN']);
      const warnCount = warns ? warns.count : 0;

      const config = db.get('SELECT * FROM warn_config WHERE guild_id = ? AND threshold = ?', [interaction.guild.id, warnCount]);

      if (config) {
        const action = config.action;
        const autoReason = `Sanction automatique : ${warnCount}e avertissement atteint`;
        const duration = config.duration ? parseDuration(config.duration) : null; // Seconds
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = duration ? now + duration : null;

        let autoSuccess = false;
        let autoDetails = '';

        try {
            if (action === 'MUTE' && member) {
                if (duration) {
                    await member.timeout(duration * 1000, autoReason);
                    autoDetails = `Mute (${config.duration})`;
                    autoSuccess = true;
                }
            } else if (action === 'KICK' && member) {
                await member.kick(autoReason);
                autoDetails = 'Kick';
                autoSuccess = true;
            } else if (action === 'BAN') {
                await interaction.guild.members.ban(targetUser.id, { reason: autoReason });
                autoDetails = duration ? `Tempban (${config.duration})` : 'Ban';
                autoSuccess = true;
            }

            if (autoSuccess) {
                const type = (action === 'BAN' && duration) ? 'TEMPBAN' : action;

                // DM for Auto-Action
                const autoDm = await sendModerationDM(targetUser, interaction.guild, type, autoReason, config.duration);

                // Log Auto-Action
                const autoInfractionId = createInfraction(interaction.guild, targetUser, interaction.client.user, type, autoReason, expiresAt);
                await logToModChannel(interaction.guild, targetUser, interaction.client.user, type, autoReason, config.duration, autoInfractionId);

                await interaction.followUp({
                    content: `🛑 **Escalade des sanctions** : Suite à son ${warnCount}ème avertissement, **${targetUser.tag}** a subi : **${autoDetails}**.${autoDm.sent ? '' : '\n(MP impossible)'}`,
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (err) {
            console.error(`Auto-action error for ${targetUser.id}:`, err);
            await interaction.followUp({
                content: `⚠️ Erreur lors de l'application de la sanction automatique (${action}) : ${err.message}`,
                flags: MessageFlags.Ephemeral
            });
        }
      }

    } catch (error) {
      // Check if reply was already sent to avoid error
      if (interaction.replied || interaction.deferred) {
         return interaction.followUp({
            content: `❌ Une erreur est survenue : ${error.message}`,
            flags: MessageFlags.Ephemeral
         });
      } else {
         return interaction.reply({
            content: `❌ Une erreur est survenue : ${error.message}`,
            flags: MessageFlags.Ephemeral
         });
      }
    }
  },
};
