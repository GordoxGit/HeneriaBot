/**
 * Commande /welcomemessage
 * Personnalise le message de bienvenue
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomemessage')
    .setDescription('Personnalise le message de bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le message à envoyer (Variables: {user}, {username}, {server}, {memberCount})')
        .setRequired(true)
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const message = interaction.options.getString('message');

    try {
      db.run(`
        INSERT INTO welcome_config (guild_id, message)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET message = excluded.message
      `, [interaction.guild.id, message]);

      const embed = successEmbed('Message personnalisé enregistré !')
        .addFields({
          name: 'Aperçu du texte brut',
          value: message
        })
        .addFields({
          name: 'Variables disponibles',
          value: '`{user}` (Mention), `{username}` (Pseudo), `{server}` (Serveur), `{memberCount}` (Compteur)'
        });

      await interaction.reply({
        embeds: [embed]
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors de la sauvegarde du message.')],
        ephemeral: true
      });
    }
  },
};
