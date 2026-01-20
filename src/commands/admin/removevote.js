const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removevote')
    .setDescription('Supprimer un site de vote')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom du site à supprimer')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  /**
   * Gestion de l'autocomplétion
   * @param {import('discord.js').AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      // Récupérer les sites depuis la BDD correspondant à la saisie
      const sites = db.all(
        'SELECT name FROM vote_sites WHERE guild_id = ? AND name LIKE ? LIMIT 25',
        [guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        sites.map(site => ({ name: site.name, value: site.name }))
      );
    } catch (error) {
      console.error('Erreur autocomplete removevote:', error);
      // En cas d'erreur, on renvoie une liste vide pour ne pas bloquer l'utilisateur
      await interaction.respond([]);
    }
  },

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const nom = interaction.options.getString('nom');
    const guildId = interaction.guild.id;

    try {
      // Suppression BDD
      const result = db.run(
        'DELETE FROM vote_sites WHERE guild_id = ? AND name = ?',
        [guildId, nom]
      );

      if (result.changes > 0) {
        // Embed de confirmation
        const successEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🗑️ Site de vote supprimé')
          .setDescription(`Le site **${nom}** a été supprimé avec succès !`);

        await interaction.reply({ embeds: [successEmbed] });
      } else {
        // Si le site n'existe pas
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Erreur')
          .setDescription(`Le site **${nom}** n'existe pas.`);

        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }

    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors de la suppression du site de vote.');

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
