/**
 * Événement interactionCreate
 * Gère les interactions (commandes slash)
 */

const { Events } = require('discord.js');
const { errorEmbed } = require('../utils/embedBuilder');
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
        logger.info(`Bouton ${interaction.customId} cliqué par ${interaction.user.tag}`);
        // Pour l'instant, on ne fait que logger l'interaction
        // On répond pour éviter l'erreur "L'interaction a échoué"
        await interaction.reply({
          content: 'Votre demande a été prise en compte (Mode test)',
          ephemeral: true
        });
        return;
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
