const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { COLORS } = require('../../config/constants');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelreward')
    .setDescription('Gérer les récompenses de niveau (rôles)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter une récompense de rôle pour un niveau')
        .addIntegerOption(option => option.setName('level').setDescription('Le niveau requis').setRequired(true).setMinValue(1))
        .addRoleOption(option => option.setName('role').setDescription('Le rôle à donner').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Supprimer une récompense de niveau')
        .addIntegerOption(option => option.setName('level').setDescription('Le niveau').setRequired(true).setMinValue(1))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lister toutes les récompenses de niveau')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      try {
        db.run(
            'INSERT OR REPLACE INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)',
            [guildId, level, role.id]
        );

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('Récompense ajoutée')
          .setDescription(`Le rôle ${role} sera donné au **niveau ${level}**.`);

        await interaction.reply({ embeds: [embed] });

      } catch (error) {
        logger.error(`Erreur levelreward add: ${error.message}`);
        await interaction.reply({ content: 'Une erreur est survenue lors de l\'ajout de la récompense.', ephemeral: true });
      }

    } else if (subcommand === 'remove') {
      const level = interaction.options.getInteger('level');

      try {
        const result = db.run(
            'DELETE FROM level_rewards WHERE guild_id = ? AND level = ?',
            [guildId, level]
        );

        if (result.changes > 0) {
           await interaction.reply({
               embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setDescription(`Récompense pour le **niveau ${level}** supprimée.`)]
           });
        } else {
           await interaction.reply({ content: `Aucune récompense trouvée pour le niveau ${level}.`, ephemeral: true });
        }

      } catch (error) {
         logger.error(`Erreur levelreward remove: ${error.message}`);
         await interaction.reply({ content: 'Une erreur est survenue lors de la suppression.', ephemeral: true });
      }

    } else if (subcommand === 'list') {
       const rewards = db.all(
           'SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC',
           [guildId]
       );

       if (rewards.length === 0) {
           return interaction.reply({ content: 'Aucune récompense de niveau configurée.', ephemeral: true });
       }

       const embed = new EmbedBuilder()
         .setColor(COLORS.PRIMARY)
         .setTitle(`Récompenses de niveau - ${interaction.guild.name}`)
         .setDescription(rewards.map(r => `• **Niveau ${r.level}** : <@&${r.role_id}>`).join('\n'));

       await interaction.reply({ embeds: [embed] });
    }
  }
};
