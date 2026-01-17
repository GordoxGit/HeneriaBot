/**
 * Commande /setwelcome
 * Définit le salon de bienvenue
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Définit le salon de bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où envoyer les cartes de bienvenue')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');

    // Verification supplémentaire (bien que addChannelTypes le fasse déjà en partie pour l'interface)
    if (!channel.isTextBased()) {
        return interaction.reply({
            embeds: [errorEmbed('Veuillez sélectionner un salon textuel.')],
            ephemeral: true
        });
    }

    try {
      // Upsert dans la base de données
      // On utilise INSERT ... ON CONFLICT pour préserver les autres colonnes (message, enabled)
      db.run(`
        INSERT INTO welcome_config (guild_id, channel_id)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
      `, [interaction.guild.id, channel.id]);

      await interaction.reply({
        embeds: [successEmbed(`Salon de bienvenue configuré sur ${channel}`)]
      });

    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed('Une erreur est survenue lors de la sauvegarde de la configuration.')],
        ephemeral: true
      });
    }
  },
};
