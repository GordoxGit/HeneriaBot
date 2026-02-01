const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const levelSystem = require('../../utils/levelSystem');
const { COLORS } = require('../../config/constants');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('managexp')
    .setDescription('Gérer l\'expérience des utilisateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter de l\'XP à un utilisateur')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Montant d\'XP').setRequired(true).setMinValue(1))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retirer de l\'XP à un utilisateur')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Montant d\'XP').setRequired(true).setMinValue(1))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Définir le niveau ou l\'XP d\'un utilisateur')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true))
        .addIntegerOption(option => option.setName('level').setDescription('Niveau à définir').setMinValue(0))
        .addIntegerOption(option => option.setName('xp').setDescription('XP total à définir').setMinValue(0))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guild.id;

    // Récupérer les données actuelles ou initialiser
    let userLevel = db.get(
      'SELECT * FROM user_levels WHERE user_id = ? AND guild_id = ?',
      [targetUser.id, guildId]
    );

    if (!userLevel) {
      db.run(
        'INSERT INTO user_levels (user_id, guild_id, xp, level, total_messages, last_message_timestamp) VALUES (?, ?, 0, 0, 0, 0)',
        [targetUser.id, guildId]
      );
      userLevel = {
        user_id: targetUser.id,
        guild_id: guildId,
        xp: 0,
        level: 0,
        total_messages: 0,
        last_message_timestamp: 0
      };
    }

    let newXp = userLevel.xp;
    let message = '';

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount');
      newXp += amount;
      message = `Ajout de **${amount} XP** à ${targetUser}.`;
    } else if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount');
      newXp = Math.max(0, newXp - amount);
      message = `Retrait de **${amount} XP** à ${targetUser}.`;
    } else if (subcommand === 'set') {
      const level = interaction.options.getInteger('level');
      const xp = interaction.options.getInteger('xp');

      if (level === null && xp === null) {
        return interaction.reply({ content: 'Vous devez spécifier soit le niveau, soit l\'XP total.', ephemeral: true });
      }

      if (level !== null) {
        newXp = levelSystem.getTotalXpForLevel(level);
        message = `Niveau de ${targetUser} défini à **${level}** (XP ajusté à ${newXp}).`;
      } else {
        newXp = xp;
        message = `XP total de ${targetUser} défini à **${xp}**.`;
      }
    }

    // Recalculer le niveau basé sur le nouvel XP
    const progress = levelSystem.calculateLevelProgress(newXp);
    const newLevel = progress.level;

    // Mise à jour BDD
    db.run(
      'UPDATE user_levels SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?',
      [newXp, newLevel, targetUser.id, guildId]
    );

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('Gestion XP')
      .setDescription(message)
      .addFields(
        { name: 'Nouveau Niveau', value: `${newLevel}`, inline: true },
        { name: 'Nouvel XP Total', value: `${newXp}`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
