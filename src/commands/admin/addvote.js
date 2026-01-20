const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addvote')
    .setDescription('Ajouter un site de vote')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom du site')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option.setName('lien')
        .setDescription('URL du site')
        .setRequired(true)
        .setMaxLength(500)
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const nom = interaction.options.getString('nom');
    const lien = interaction.options.getString('lien');
    const guildId = interaction.guild.id;

    // Validation de l'URL
    if (!lien.startsWith('http://') && !lien.startsWith('https://')) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Erreur')
        .setDescription('L\'URL doit commencer par `http://` ou `https://`.');

      return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }

    try {
      // Vérifier si le site existe déjà
      const existing = db.get('SELECT 1 FROM vote_sites WHERE guild_id = ? AND name = ?', [guildId, nom]);

      if (existing) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Erreur')
          .setDescription(`Le site de vote **${nom}** existe déjà.`);

        return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

      // Insertion en BDD
      // On calcule la position max + 1 pour ajouter à la fin
      db.run(
        `INSERT INTO vote_sites (guild_id, name, url, position)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM vote_sites WHERE guild_id = ?))`,
        [guildId, nom, lien, guildId]
      );

      // Embed de confirmation
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Site de vote ajouté')
        .setDescription(`Le site **${nom}** a été ajouté avec succès !`)
        .addFields(
          { name: 'Nom', value: nom, inline: true },
          { name: 'URL', value: `[Cliquer ici](${lien})`, inline: true }
        );

      await interaction.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors de l\'ajout du site de vote.');

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
