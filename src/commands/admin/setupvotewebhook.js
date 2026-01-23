const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const WebhookVoteService = require('../../services/webhookVoteService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupvotewebhook')
    .setDescription('[Admin] Configurer un webhook pour un site de vote')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Salon où créer le webhook (privé recommandé)')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('site')
        .setDescription('Site de vote')
        .setRequired(true)
        .addChoices(
          { name: 'hytale.game', value: 'hytale.game' },
          { name: 'hytale-servs.fr', value: 'hytale-servs.fr' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // Ephemeral using flags

    const channel = interaction.options.getChannel('channel');
    const site = interaction.options.getString('site');

    try {
      // Créer le webhook
      const webhook = await channel.createWebhook({
        name: `${site} Votes`,
        reason: 'Webhook pour détecter les votes'
      });

      // Enregistrer en BDD
      WebhookVoteService.registerWebhook(
        interaction.guildId,
        site,
        webhook.id,
        channel.id
      );

      await interaction.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Webhook créé',
          description: `Le webhook pour **${site}** a été créé avec succès !`,
          fields: [
            {
              name: '📋 URL du webhook',
              value: `\`\`\`${webhook.url}\`\`\``,
              inline: false
            },
            {
              name: '📝 Instructions',
              value: `1. Copiez l'URL ci-dessus\n` +
                     `2. Allez sur le site ${site}\n` +
                     `3. Collez cette URL dans la configuration\n` +
                     `4. Testez avec un vote !`,
              inline: false
            },
            {
              name: '🔒 Sécurité',
              value: `Le webhook a été créé dans ${channel}. ` +
                     `Ce salon devrait être **privé** pour éviter le spam.`,
              inline: false
            }
          ],
          footer: { text: 'Heneria • Système de votes' }
        }]
      });

      logger.success(`[Setup Webhook] ✅ Créé pour ${site}: ${webhook.id}`);

    } catch (error) {
      logger.error(`[Setup Webhook] Erreur: ${error.message}`);
      await interaction.editReply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Erreur',
          description: 'Impossible de créer le webhook.\n' +
                       'Vérifiez que le bot a les permissions nécessaires dans ce salon.'
        }]
      });
    }
  }
};
