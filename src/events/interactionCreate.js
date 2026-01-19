/**
 * Événement interactionCreate
 * Gère les interactions (commandes slash)
 */

const { Events } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');
const {
  createTicket,
  claimTicket,
  closeTicket,
  confirmCloseTicket,
  cancelCloseTicket
} = require('../utils/ticketManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  /**
   * Exécute l'événement
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {
    // Gestion des boutons
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];

        // Gestion de la création de tickets
        if (['help', 'report', 'partnership', 'bug'].includes(action)) {
          await createTicket(interaction, action);
          return;
        }

        // Gestion de la prise en charge (Claim)
        if (action === 'claim') {
            const ticketId = parts[2];
            await claimTicket(interaction, ticketId);
            return;
        }

        // Gestion de la demande de fermeture
        if (action === 'close') {
            const ticketId = parts[2] || null;
            await closeTicket(interaction, ticketId);
            return;
        }

        // Confirmation de fermeture
        if (action === 'confirm' && parts[2] === 'close') {
            const ticketId = parts[3];
            await confirmCloseTicket(interaction, ticketId);
            return;
        }

        // Annulation de fermeture
        if (action === 'cancel' && parts[2] === 'close') {
            await cancelCloseTicket(interaction);
            return;
        }

        // Les autres boutons seront gérés ici ou loggés
        logger.info(`Bouton ${interaction.customId} cliqué par ${interaction.user.tag} (Non géré par ce handler)`);
      }
    }

    // On ne traite que les commandes slash (ChatInputCommand)
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Commande ${interaction.commandName} introuvable.`);
      return;
    }

    try {
      // Logger l'exécution de la commande
      logger.info(`Utilisateur ${interaction.user.tag} a exécuté la commande /${interaction.commandName}`);

      await command.execute(interaction);
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la commande ${interaction.commandName}: ${error}`);
      console.error(error); // Pour le stack trace complet en dev

      const embed = errorEmbed('Une erreur est survenue lors de l\'exécution de cette commande.');

      // Si la réponse a déjà été envoyée ou différée, on utilise followUp, sinon reply
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
