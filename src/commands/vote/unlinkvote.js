const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlinkvote')
    .setDescription('Délier votre pseudo d\'un site de vote')
    .addStringOption(option =>
      option.setName('site')
        .setDescription('Le site de vote')
        .setRequired(true)
        .addChoices(
          { name: 'serveur-prive.net', value: 'serveur-prive.net' },
          { name: 'top-serveurs.net', value: 'top-serveurs.net' }
        )),

  async execute(interaction) {
    const site = interaction.options.getString('site');

    try {
      // Vérifier si une liaison existe
      const link = db.get(`
        SELECT site_username, verified FROM vote_username_links
        WHERE user_id = ? AND guild_id = ? AND site_name = ?
      `, [interaction.user.id, interaction.guildId, site]);

      if (!link) {
        return interaction.reply({
          embeds: [{
            color: 0xff9900,
            title: '⚠️ Aucune liaison',
            description: `Vous n'avez pas de liaison active sur **${site}**.`
          }],
          ephemeral: true
        });
      }

      // Supprimer la liaison
      db.run(`
        DELETE FROM vote_username_links
        WHERE user_id = ? AND guild_id = ? AND site_name = ?
      `, [interaction.user.id, interaction.guildId, site]);

      // Confirmation
      await interaction.reply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Liaison supprimée',
          description: `Votre pseudo **${link.site_username}** a été délié de **${site}**.`,
          fields: [
            {
              name: 'Statut',
              value: link.verified ? '✅ Liaison vérifiée supprimée' : '⏳ Liaison en attente supprimée',
              inline: true
            }
          ]
        }],
        ephemeral: true
      });

    } catch (error) {
      console.error('[unlinkvote] Erreur:', error);
      await interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Erreur',
          description: 'Une erreur est survenue lors de la suppression de la liaison.'
        }],
        ephemeral: true
      });
    }
  }
};
