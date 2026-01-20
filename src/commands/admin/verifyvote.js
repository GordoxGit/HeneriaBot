const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const voteHandler = require('../../handlers/voteHandler');
const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifyvote')
    .setDescription('Vérifier manuellement un vote')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur qui a voté')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('site')
        .setDescription('Le site de vote')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();

    try {
      // Récupérer les sites depuis la BDD
      const sites = db.all(
        'SELECT name FROM vote_sites WHERE guild_id = ? AND name LIKE ?',
        [interaction.guildId, `%${focusedValue}%`]
      );

      await interaction.respond(
        sites.map(site => ({ name: site.name, value: site.name }))
      );
    } catch (error) {
      logger.error(`Erreur autocomplete verifyvote: ${error.message}`);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const siteName = interaction.options.getString('site');

    try {
      // Vérifier que le site existe
      const site = db.get(
        'SELECT * FROM vote_sites WHERE guild_id = ? AND name = ?',
        [interaction.guildId, siteName]
      );

      if (!site) {
        return interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Erreur',
            description: `Le site **${siteName}** n'existe pas.`
          }],
          flags: MessageFlags.Ephemeral
        });
      }

      // Vérifier le cooldown
      if (await voteHandler.isOnCooldown(user.id, interaction.guildId, siteName)) {
        return interaction.reply({
          embeds: [{
            color: 0xff9900,
            title: '⏰ Cooldown actif',
            description: `${user} est encore en cooldown sur **${siteName}**.`
          }],
          flags: MessageFlags.Ephemeral
        });
      }

      // Traiter le vote manuellement
      const voteData = {
        userId: user.id,
        guildId: interaction.guildId,
        siteName: siteName
      };

      await voteHandler.processVote(voteData, 'manual', interaction.user.id);

      // Confirmation
      await interaction.reply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Vote vérifié',
          description: `Le vote de ${user} sur **${siteName}** a été enregistré manuellement.`,
          fields: [
            { name: 'Vérifié par', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          ]
        }]
      });

      logger.info(`Vote manuel vérifié par ${interaction.user.tag} pour ${user.tag} sur ${siteName}`);

    } catch (error) {
      logger.error('Erreur vérification vote:', error);
      await interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Erreur',
          description: 'Une erreur est survenue lors de la vérification du vote.'
        }],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
