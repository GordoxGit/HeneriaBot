const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Gérer la présentation de l\'équipe')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter un membre à l\'équipe')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true))
        .addStringOption(option => option.setName('titre').setDescription('Le rôle affiché (ex: Fondateur)').setRequired(true))
        .addIntegerOption(option => option.setName('position').setDescription('Ordre d\'affichage (1 = haut)').setRequired(true))
        .addStringOption(option => option.setName('lien').setDescription('Lien social (optionnel)').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retirer un membre de l\'équipe')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('update')
        .setDescription('Modifier les informations d\'un membre')
        .addUserOption(option => option.setName('user').setDescription('L\'utilisateur').setRequired(true))
        .addStringOption(option => option.setName('titre').setDescription('Nouveau titre').setRequired(false))
        .addIntegerOption(option => option.setName('position').setDescription('Nouvelle position').setRequired(false))
        .addStringOption(option => option.setName('lien').setDescription('Nouveau lien').setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Initialiser le message de l\'équipe dans ce salon'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('refresh')
        .setDescription('Mettre à jour l\'affichage de l\'équipe')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user');
      const roleLabel = interaction.options.getString('titre');
      const position = interaction.options.getInteger('position');
      const link = interaction.options.getString('lien');

      try {
        db.run(
          'INSERT INTO team_members (guild_id, user_id, role_label, order_position, social_link) VALUES (?, ?, ?, ?, ?)',
          [guildId, user.id, roleLabel, position, link]
        );
        return interaction.reply({
          embeds: [successEmbed(`**${user.username}** a été ajouté à l'équipe (Position ${position}).`)],
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de l\'ajout du membre.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'remove') {
      const user = interaction.options.getUser('user');
      try {
        const result = db.run('DELETE FROM team_members WHERE guild_id = ? AND user_id = ?', [guildId, user.id]);
        if (result.changes === 0) {
          return interaction.reply({
            embeds: [errorEmbed(`**${user.username}** n'est pas dans la liste de l'équipe.`)],
            flags: MessageFlags.Ephemeral
          });
        }
        return interaction.reply({
          embeds: [successEmbed(`**${user.username}** a été retiré de l'équipe.`)],
          flags: MessageFlags.Ephemeral
        });
      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de la suppression.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'update') {
      const user = interaction.options.getUser('user');
      const roleLabel = interaction.options.getString('titre');
      const position = interaction.options.getInteger('position');
      const link = interaction.options.getString('lien');

      try {
        const current = db.get('SELECT * FROM team_members WHERE guild_id = ? AND user_id = ?', [guildId, user.id]);
        if (!current) {
          return interaction.reply({
            embeds: [errorEmbed(`**${user.username}** n'est pas dans la liste. Utilisez /team add d'abord.`)],
            flags: MessageFlags.Ephemeral
          });
        }

        const newRole = roleLabel !== null ? roleLabel : current.role_label;
        const newPos = position !== null ? position : current.order_position;
        const newLink = link !== null ? link : current.social_link;

        db.run(
          'UPDATE team_members SET role_label = ?, order_position = ?, social_link = ? WHERE id = ?',
          [newRole, newPos, newLink, current.id]
        );

        return interaction.reply({
          embeds: [successEmbed(`Informations de **${user.username}** mises à jour.`)],
          flags: MessageFlags.Ephemeral
        });

      } catch (error) {
        console.error(error);
        return interaction.reply({
          embeds: [errorEmbed('Erreur lors de la mise à jour.')],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (subcommand === 'setup') {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const embed = await generateTeamEmbed(interaction.guild, interaction.client);
        const sentMsg = await interaction.channel.send({ embeds: [embed] });

        db.run('INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)', [guildId, 'team_channel_id', interaction.channel.id]);
        db.run('INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)', [guildId, 'team_message_id', sentMsg.id]);

        return interaction.editReply({
          embeds: [successEmbed('Message de l\'équipe configuré dans ce salon.')]
        });
      } catch (error) {
        console.error(error);
        return interaction.editReply({
          embeds: [errorEmbed('Erreur lors du setup.')]
        });
      }
    }

    if (subcommand === 'refresh') {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channelIdRow = db.get('SELECT value FROM settings WHERE guild_id = ? AND key = ?', [guildId, 'team_channel_id']);
        const messageIdRow = db.get('SELECT value FROM settings WHERE guild_id = ? AND key = ?', [guildId, 'team_message_id']);

        if (!channelIdRow || !messageIdRow) {
          return interaction.editReply({ embeds: [errorEmbed('La configuration n\'a pas été trouvée. Utilisez /team setup d\'abord.')] });
        }

        const channel = await interaction.guild.channels.fetch(channelIdRow.value).catch(() => null);
        if (!channel) {
          return interaction.editReply({ embeds: [errorEmbed('Le salon configuré n\'existe plus.')] });
        }

        const message = await channel.messages.fetch(messageIdRow.value).catch(() => null);
        if (!message) {
          return interaction.editReply({ embeds: [errorEmbed('Le message configuré n\'existe plus. Refaites un setup.')] });
        }

        const embed = await generateTeamEmbed(interaction.guild, interaction.client);
        await message.edit({ embeds: [embed] });

        return interaction.editReply({ embeds: [successEmbed('Affichage de l\'équipe mis à jour.')] });

      } catch (error) {
        console.error(error);
        if (!interaction.replied) {
          return interaction.editReply({ embeds: [errorEmbed('Erreur lors du rafraîchissement.')] });
        }
      }
    }
  },
};

async function generateTeamEmbed(guild, client) {
  const rows = db.all('SELECT * FROM team_members WHERE guild_id = ? ORDER BY order_position ASC', [guild.id]);

  const embed = new EmbedBuilder()
    .setTitle('Notre Équipe')
    .setColor(0x780CED)
    .setFooter({ text: 'Heneria • Bot Discord' })
    .setTimestamp();

  if (rows.length === 0) {
    embed.setDescription('Aucun membre dans l\'équipe pour le moment.');
    return embed;
  }

  // Si moins de 25 membres, on utilise des Fields
  if (rows.length <= 25) {
    for (const row of rows) {
      const user = await client.users.fetch(row.user_id).catch(() => null);
      const userName = user ? user.tag : 'Utilisateur Inconnu';

      let fieldValue = `🏆 **${row.role_label}**`;
      if (row.social_link) {
        fieldValue += `\n🔗 [Lien](${row.social_link})`;
      }

      embed.addFields({ name: userName, value: fieldValue, inline: true });
    }
  } else {
    // Sinon on passe en mode liste description
    let description = '';
    for (const row of rows) {
      const user = await client.users.fetch(row.user_id).catch(() => null);
      const userName = user ? user.username : 'Inconnu';

      description += `**${userName}** - ${row.role_label}`;
      if (row.social_link) description += ` - [Lien](${row.social_link})`;
      description += '\n';
    }

    if (description.length > 4096) {
      description = description.substring(0, 4093) + '...';
    }
    embed.setDescription(description);
  }

  return embed;
}
