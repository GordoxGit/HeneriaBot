const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { updateMemberCounter } = require('../../utils/memberCounter');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('counterformat')
    .setDescription('Personnalise le format d\'affichage du compteur')
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Le format (ex: "👥 Membres : {count}")')
        .setRequired(true)
        .setMaxLength(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const format = interaction.options.getString('format');

    if (!format.includes('{count}')) {
      return interaction.reply({
        embeds: [errorEmbed('Le format doit contenir `{count}` pour afficher le nombre de membres.')],
        ephemeral: true
      });
    }

    try {
      // Vérifier si une config existe déjà
      const existingConfig = db.get('SELECT * FROM counter_config WHERE guild_id = ?', [interaction.guild.id]);

      if (existingConfig) {
        // Mise à jour
        db.run('UPDATE counter_config SET format = ? WHERE guild_id = ?', [format, interaction.guild.id]);
      } else {
        // Création (sans channel_id pour l'instant)
        db.run('INSERT INTO counter_config (guild_id, format) VALUES (?, ?)', [interaction.guild.id, format]);
      }

      // Forcer la mise à jour immédiate
      await updateMemberCounter(interaction.guild, true);

      await interaction.reply({
        embeds: [
          successEmbed('Format personnalisé enregistré !'),
          infoEmbed(`Nouveau format : \`${format}\``)
        ]
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors de la configuration du format.')],
        ephemeral: true
      });
    }
  },
};
