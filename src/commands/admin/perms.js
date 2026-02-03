const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perms')
    .setDescription('Gérer les permissions des commandes (Système Heneria)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Autoriser un rôle à utiliser une commande')
        .addStringOption(option =>
          option.setName('commande')
            .setDescription('Le nom de la commande (sans /)')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Le rôle à autoriser')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retirer l\'autorisation d\'un rôle pour une commande')
        .addStringOption(option =>
          option.setName('commande')
            .setDescription('Le nom de la commande (sans /)')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Le rôle à retirer')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lister les permissions configurées')
        .addStringOption(option =>
          option.setName('commande')
            .setDescription('Filtrer par commande (optionnel)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Réinitialiser les permissions d\'une commande (retour aux défauts)')
        .addStringOption(option =>
          option.setName('commande')
            .setDescription('Le nom de la commande (sans /)')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const commandName = interaction.options.getString('commande')?.toLowerCase();
    const role = interaction.options.getRole('role');
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      try {
        // Vérifier si la commande existe
        const cmd = interaction.client.commands.get(commandName);
        if (!cmd) {
          return interaction.reply({
            embeds: [errorEmbed(`La commande \`${commandName}\` n'existe pas.`)],
            flags: MessageFlags.Ephemeral
          });
        }

        db.run('INSERT OR IGNORE INTO command_permissions (guild_id, command_name, role_id) VALUES (?, ?, ?)', [guildId, commandName, role.id]);

        return interaction.reply({
          embeds: [successEmbed(`Le rôle ${role} peut désormais utiliser la commande \`/${commandName}\`.`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de l\'ajout de la permission.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'remove') {
      try {
        const result = db.run('DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ? AND role_id = ?', [guildId, commandName, role.id]);

        if (result.changes === 0) {
          return interaction.reply({
            embeds: [errorEmbed(`Ce rôle n'avait pas de permission spécifique pour \`/${commandName}\`.`)],
            flags: MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          embeds: [successEmbed(`Le rôle ${role} n'a plus la permission spécifique pour \`/${commandName}\`.`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de la suppression de la permission.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'reset') {
      try {
        const result = db.run('DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ?', [guildId, commandName]);

        return interaction.reply({
          embeds: [successEmbed(`Toutes les permissions personnalisées pour \`/${commandName}\` ont été supprimées (${result.changes} règles effacées).`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de la réinitialisation.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'list') {
      try {
        let sql = 'SELECT command_name, role_id FROM command_permissions WHERE guild_id = ?';
        const params = [guildId];

        if (commandName) {
          sql += ' AND command_name = ?';
          params.push(commandName);
        }

        sql += ' ORDER BY command_name ASC';

        const rows = db.all(sql, params);

        if (rows.length === 0) {
          return interaction.reply({
            embeds: [infoEmbed('Aucune permission personnalisée configurée.')],
            flags: MessageFlags.Ephemeral
          });
        }

        // Grouper par commande
        const permsByCmd = {};
        rows.forEach(row => {
          if (!permsByCmd[row.command_name]) permsByCmd[row.command_name] = [];
          permsByCmd[row.command_name].push(`<@&${row.role_id}>`);
        });

        const embed = infoEmbed('Permissions Personnalisées');
        let description = '';

        for (const [cmd, roles] of Object.entries(permsByCmd)) {
          description += `**/${cmd}** : ${roles.join(', ')}\n`;
        }

        // Gestion des limites de l'embed
        if (description.length > 4096) {
          description = description.substring(0, 4093) + '...';
        }

        embed.setDescription(description);

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de la récupération de la liste.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },
};
