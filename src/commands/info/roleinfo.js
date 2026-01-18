/**
 * Commande /roleinfo
 * Affiche les informations détaillées d'un rôle
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription("Affiche les informations sur un rôle")
    .addRoleOption(option =>
      option.setName('role')
        .setDescription("Le rôle à analyser")
        .setRequired(true)),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const role = interaction.options.getRole('role');

    // Informations de base
    const createdTimestamp = Math.floor(role.createdTimestamp / 1000);
    const color = role.hexColor;
    const membersCount = role.members.size;
    const isMentionable = role.mentionable ? 'Oui' : 'Non';
    const isManaged = role.managed ? 'Oui (Intégration)' : 'Non';
    const isHoisted = role.hoist ? 'Oui' : 'Non';

    // Permissions
    const permissions = role.permissions.toArray();
    const isAdmin = role.permissions.has(PermissionFlagsBits.Administrator);

    // Formatage des permissions pour l'affichage (Max 10)
    // On pourrait mapper vers du français, mais pour l'instant on formate l'anglais
    const formattedPermissions = permissions.map(p => {
        // Ajoute un espace avant les majuscules et capitalize
        return p.replace(/([A-Z])/g, ' $1').trim();
    });

    const displayedPermissions = formattedPermissions.slice(0, 10).join('\n• ');
    const remainingPermissions = formattedPermissions.length > 10
        ? `\n... et ${formattedPermissions.length - 10} autres`
        : '';

    const permissionsString = isAdmin
        ? '⚠️ **ADMINISTRATEUR** (Toutes les permissions)'
        : (formattedPermissions.length > 0 ? `• ${displayedPermissions}${remainingPermissions}` : 'Aucune permission');

    const embed = createEmbed()
      .setTitle(`Informations sur le rôle ${role.name}`)
      .setColor(role.color || 0x780CED)
      .addFields(
        {
          name: '🆔 Identité',
          value: `**Nom:** ${role.toString()}\n**ID:** ${role.id}\n**Couleur:** ${color}\n**Position:** ${role.position}`,
          inline: true
        },
        {
          name: '⚙️ Configuration',
          value: `**Mentionnable:** ${isMentionable}\n**Affiché séparément:** ${isHoisted}\n**Géré par système:** ${isManaged}`,
          inline: true
        },
        {
          name: '📊 Statistiques',
          value: `**Membres:** ${membersCount}\n**Créé le:** <t:${createdTimestamp}:f> (<t:${createdTimestamp}:R>)`,
          inline: false
        },
        {
          name: '🔐 Permissions',
          value: permissionsString,
          inline: false
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
