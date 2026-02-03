const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { parseDuration } = require('../../utils/timeParser');
const giveawayHandler = require('../../handlers/giveawayHandler');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Système de giveaway')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Lancer un giveaway')
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Durée (ex: 1h, 30m, 2d)')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('winners')
            .setDescription('Nombre de gagnants')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('prize')
            .setDescription('Prix à gagner')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('Arrêter un giveaway manuellement')
        .addStringOption(option =>
          option.setName('message_id')
            .setDescription('ID du message du giveaway')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Relancer le tirage d\'un giveaway terminé')
        .addStringOption(option =>
          option.setName('message_id')
            .setDescription('ID du message du giveaway')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      await handleStart(interaction);
    } else if (subcommand === 'end') {
      await handleEnd(interaction);
    } else if (subcommand === 'reroll') {
      await handleReroll(interaction);
    }
  },
};

async function handleStart(interaction) {
  const durationStr = interaction.options.getString('duration');
  const winnersCount = interaction.options.getInteger('winners');
  const prize = interaction.options.getString('prize');

  const durationSeconds = parseDuration(durationStr);
  if (!durationSeconds) {
    return interaction.reply({ content: 'Format de durée invalide. Utilisez s, m, h, ou d (ex: 1h, 30m).', ephemeral: true });
  }

  const endTimestamp = Date.now() + (durationSeconds * 1000);
  const endDate = new Date(endTimestamp);

  const embed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(`**Prix :** ${prize}\n**Host :** ${interaction.user}\n**Gagnants :** ${winnersCount}\n\nRéagissez avec 🎉 pour participer !`)
    .setColor('#FF0000') // Utiliser une constante de couleur si disponible, mais hardcodé pour l'instant
    .setFooter({ text: `Fin le ${endDate.toLocaleString('fr-FR')}` })
    .setTimestamp(endDate);

  const message = await interaction.reply({ embeds: [embed], fetchReply: true });
  await message.react('🎉');

  try {
    db.run(
      `INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, end_timestamp, host_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [message.id, interaction.channelId, interaction.guildId, prize, winnersCount, endTimestamp, interaction.user.id]
    );
    // Pas de réponse supplémentaire car on a déjà répondu avec l'embed du giveaway
  } catch (error) {
    logger.error(`Erreur création giveaway : ${error.message}`);
    await interaction.followUp({ content: 'Erreur lors de la sauvegarde du giveaway en base de données.', ephemeral: true });
  }
}

async function handleEnd(interaction) {
  const messageId = interaction.options.getString('message_id');

  const giveaway = db.get('SELECT * FROM giveaways WHERE message_id = ?', [messageId]);

  if (!giveaway) {
    return interaction.reply({ content: 'Giveaway introuvable.', ephemeral: true });
  }

  if (giveaway.ended) {
    return interaction.reply({ content: 'Ce giveaway est déjà terminé.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // On force la fin
    await giveawayHandler.endGiveaway(interaction.client, giveaway);
    await interaction.editReply('Giveaway arrêté avec succès.');
  } catch (error) {
    logger.error(`Erreur arrêt giveaway : ${error.message}`);
    await interaction.editReply('Une erreur est survenue lors de l\'arrêt du giveaway.');
  }
}

async function handleReroll(interaction) {
  const messageId = interaction.options.getString('message_id');

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await giveawayHandler.reroll(interaction.client, messageId);
    await interaction.editReply(result);
  } catch (error) {
    await interaction.editReply(`Erreur : ${error.message}`);
  }
}
