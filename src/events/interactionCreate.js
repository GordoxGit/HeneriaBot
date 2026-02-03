/**
 * Événement interactionCreate
 * Gère les interactions (commandes slash)
 */

const { Events, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const db = require('../database/db');
const {
  createTicket,
  claimTicket,
  closeTicket,
  confirmCloseTicket,
  cancelCloseTicket
} = require('../utils/ticketManager');
const { handleEmbedModal, handleEmbedButton } = require('../utils/embedInteractionManager');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  /**
   * Exécute l'événement
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {
    // Gestion des Modales Embed
    if (interaction.isModalSubmit() && interaction.customId.startsWith('embed_modal_')) {
        await handleEmbedModal(interaction);
        return;
    }

    // Gestion des Boutons Embed
    if (interaction.isButton() && interaction.customId.startsWith('embed_btn_')) {
        await handleEmbedButton(interaction);
        return;
    }

    // Gestion Autorole (Boutons et Menus)
    if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('autorole_')) {
        await handleAutoroleInteraction(interaction);
        return;
    }

    // Gestion des boutons tickets
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
      // Système de Permissions Dynamique (Middleware)
      // 1. Bypass Administrateur
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isOwner = interaction.user.id === interaction.guild.ownerId;

      if (!isAdmin && !isOwner) {
          const commandName = interaction.commandName;
          const guildId = interaction.guild.id;

          // 2. Vérification BDD
          const allowedRoles = db.all('SELECT role_id FROM command_permissions WHERE guild_id = ? AND command_name = ?', [guildId, commandName]);

          if (allowedRoles.length > 0) {
              const memberRoles = interaction.member.roles.cache;
              const hasPermission = allowedRoles.some(perm => memberRoles.has(perm.role_id));

              if (!hasPermission) {
                  return interaction.reply({
                      content: '⛔ Vous n\'avez pas la permission requise (Système Heneria).',
                      flags: MessageFlags.Ephemeral
                  });
              }
          }
      }

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

/**
 * Gère les interactions liées au système d'auto-rôle
 * @param {import('discord.js').Interaction} interaction
 */
async function handleAutoroleInteraction(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        let roleId;

        // Identification du rôle
        if (interaction.isButton()) {
            // customId: autorole_{roleId}
            roleId = interaction.customId.split('_')[1];
        } else if (interaction.isStringSelectMenu()) {
            // values: [roleId]
            roleId = interaction.values[0];
        }

        if (!roleId) {
            return interaction.editReply({ embeds: [errorEmbed('Impossible d\'identifier le rôle cible.')] });
        }

        // Vérifications
        const guild = interaction.guild;
        const member = interaction.member; // Le membre qui a cliqué
        const role = await guild.roles.fetch(roleId);

        if (!role) {
            return interaction.editReply({ embeds: [errorEmbed('Ce rôle n\'existe plus sur le serveur.')] });
        }

        // Vérification des permissions du bot
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.editReply({ embeds: [errorEmbed('Je n\'ai pas la permission de gérer les rôles.')] });
        }

        if (role.position >= botMember.roles.highest.position) {
            return interaction.editReply({ embeds: [errorEmbed('Je ne peux pas gérer ce rôle car il est supérieur ou égal au mien.')] });
        }

        // Action Toggle
        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            await interaction.editReply({ embeds: [successEmbed(`Le rôle **${role.name}** vous a été retiré ❌`)] });
        } else {
            await member.roles.add(role);
            await interaction.editReply({ embeds: [successEmbed(`Le rôle **${role.name}** vous a été ajouté ✅`)] });
        }

        // Si c'est un SelectMenu, on pourrait vouloir reset la sélection, mais on ne peut pas facilement éditer le message public sans reconstruire le menu sans sélection par défaut.
        // Comme le message est public, la sélection est "User-specific" dans l'UI Discord (parfois), mais souvent elle persiste.
        // Pour "reset" visuellement, il faudrait updateMessage, mais ça affecte tout le monde.
        // On laisse comme ça pour l'instant.

    } catch (error) {
        logger.error(`Erreur Autorole Interaction: ${error.message}`);
        await interaction.editReply({ embeds: [errorEmbed('Une erreur est survenue lors de la modification de vos rôles.')] });
    }
}
