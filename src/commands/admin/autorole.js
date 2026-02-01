const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  StringSelectMenuOptionBuilder,
  EmbedBuilder
} = require('discord.js');
const db = require('../../database/db');
const logger = require('../../utils/logger');
const { errorEmbed, successEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Gère les panneaux d\'auto-rôle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Créer un nouveau panneau d\'auto-rôle')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Le titre du panneau')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('La description du panneau')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Le type de panneau')
            .setRequired(true)
            .addChoices(
              { name: 'Boutons', value: 'button' },
              { name: 'Menu Déroulant', value: 'select' }
            ))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter un rôle à un panneau existant')
        .addIntegerOption(option =>
          option.setName('panel_id')
            .setDescription('L\'ID du panneau (donné lors de la création)')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Le rôle à distribuer')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('label')
            .setDescription('Le texte du bouton ou de l\'option')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('emoji')
            .setDescription('L\'émoji (optionnel)')
            .setRequired(false))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await handleCreate(interaction);
    } else if (subcommand === 'add') {
      await handleAdd(interaction);
    }
  }
};

async function handleCreate(interaction) {
  try {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const type = interaction.options.getString('type');

    // Création de l'embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x780CED) // COLORS.MAIN
      .setFooter({ text: 'Heneria • Auto-rôle' });

    // Envoi du message (sans composants pour l'instant)
    // On l'envoie dans le canal actuel
    const message = await interaction.channel.send({ embeds: [embed] });

    // Sauvegarde en DB
    db.run(
      `INSERT INTO autorole_panels (guild_id, channel_id, message_id, title, type) VALUES (?, ?, ?, ?, ?)`,
      [interaction.guild.id, interaction.channel.id, message.id, title, type]
    );

    // Récupération de l'ID généré
    const panel = db.get(`SELECT id FROM autorole_panels WHERE message_id = ?`, [message.id]);

    await interaction.reply({
      embeds: [successEmbed(`Panneau créé avec succès ! **ID: ${panel.id}**\nUtilisez \`/autorole add panel_id:${panel.id} ...\` pour ajouter des rôles.`)],
      ephemeral: true
    });

  } catch (error) {
    logger.error(`Erreur /autorole create: ${error.message}`);
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed('Une erreur est survenue.')], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [errorEmbed('Une erreur est survenue.')], ephemeral: true });
    }
  }
}

async function handleAdd(interaction) {
  try {
    // Différer la réponse car ça peut prendre un peu de temps (appels API Discord)
    await interaction.deferReply({ ephemeral: true });

    const panelId = interaction.options.getInteger('panel_id');
    const role = interaction.options.getRole('role');
    const label = interaction.options.getString('label');
    const emoji = interaction.options.getString('emoji');

    // Vérifier que le panel existe et appartient à la guilde
    const panel = db.get(`SELECT * FROM autorole_panels WHERE id = ? AND guild_id = ?`, [panelId, interaction.guild.id]);

    if (!panel) {
      return interaction.editReply({ embeds: [errorEmbed('Panneau introuvable ou n\'appartient pas à ce serveur.')] });
    }

    // Vérifier les limites
    const currentEntries = db.all(`SELECT * FROM autorole_entries WHERE panel_id = ?`, [panelId]);

    if (currentEntries.length >= 25) {
      return interaction.editReply({ embeds: [errorEmbed('Ce panneau a atteint la limite de 25 rôles (Limite Discord).')] });
    }

    // Ajouter l'entrée
    db.run(
      `INSERT INTO autorole_entries (panel_id, role_id, emoji, label) VALUES (?, ?, ?, ?)`,
      [panelId, role.id, emoji, label]
    );

    // Recharger les entrées
    const updatedEntries = db.all(`SELECT * FROM autorole_entries WHERE panel_id = ? ORDER BY id ASC`, [panelId]);

    // Reconstruire les composants
    const components = buildComponents(panel.type, updatedEntries);

    // Récupérer le message Discord
    try {
        const channel = await interaction.guild.channels.fetch(panel.channel_id);
        if (!channel) throw new Error('Canal introuvable');

        const message = await channel.messages.fetch(panel.message_id);
        if (!message) throw new Error('Message introuvable');

        await message.edit({ components: components });

        await interaction.editReply({ embeds: [successEmbed(`Rôle ${role} ajouté au panneau **${panel.title}** (ID: ${panel.id}).`)] });

    } catch (msgError) {
        logger.error(`Impossible de mettre à jour le message du panel : ${msgError.message}`);
        await interaction.editReply({ embeds: [errorEmbed('Rôle ajouté en base, mais impossible de mettre à jour le message (peut-être supprimé ?).')] });
    }

  } catch (error) {
    logger.error(`Erreur /autorole add: ${error.message}`);
    await interaction.editReply({ embeds: [errorEmbed('Une erreur est survenue lors de l\'ajout du rôle.')] });
  }
}

function buildComponents(type, entries) {
  const components = [];

  if (type === 'button') {
    // 5 boutons par ligne
    const rows = [];
    let currentRow = new ActionRowBuilder();

    entries.forEach((entry, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      const button = new ButtonBuilder()
        .setCustomId(`autorole_${entry.role_id}`)
        .setLabel(entry.label)
        .setStyle(ButtonStyle.Primary);

      if (entry.emoji) {
        button.setEmoji(entry.emoji);
      }

      currentRow.addComponents(button);
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  if (type === 'select') {
    if (entries.length === 0) return [];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`autorole_select`) // On utilisera un ID générique, l'handler identifiera le rôle via la value
      .setPlaceholder('Sélectionnez un rôle...')
      .setMaxValues(1) // Toggle logic => 1 selection at a time implies intention
      .setMinValues(1);

    entries.forEach(entry => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(entry.label)
        .setValue(entry.role_id); // La valeur est l'ID du rôle

      if (entry.emoji) {
        option.setEmoji(entry.emoji);
      }

      selectMenu.addOptions(option);
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return [row];
  }

  return [];
}
