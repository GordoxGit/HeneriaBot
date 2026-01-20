/**
 * Commande /userinfo
 * Affiche les informations détaillées d'un membre
 */

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations sur un membre')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Le membre dont vous voulez voir les informations')
        .setRequired(false)),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    // Essayer de récupérer le membre (nécessaire pour les infos de guilde)
    let member;
    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch (error) {
      // Si l'utilisateur n'est pas dans le serveur
      return interaction.reply({
        content: "Cet utilisateur n'est pas membre de ce serveur.",
        flags: MessageFlags.Ephemeral
      });
    }

    // 1. Informations Utilisateur
    const userTag = user.tag;
    const userId = user.id;
    const userMention = user.toString();
    const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 512 });

    // 2. Informations Membre
    const nickname = member.nickname ? member.nickname : 'Aucun';
    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
    const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

    // Rôles
    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position);

    const highestRole = member.roles.highest;
    const rolesCount = roles.size;
    const rolesDisplay = roles.first(10).map(r => r.toString()).join(', ');
    const rolesRemaining = rolesCount > 10 ? ` et ${rolesCount - 10} autres` : '';

    // 3. Statuts
    const statusMap = {
      online: '🟢 En ligne',
      idle: '🟠 Absent',
      dnd: '🔴 Ne pas déranger',
      offline: '⚫ Hors ligne',
      invisible: '⚫ Hors ligne'
    };
    // Note: Sans l'intent GUILD_PRESENCES, member.presence peut être null
    const status = member.presence ? statusMap[member.presence.status] || '⚫ Hors ligne' : '⚫ Hors ligne (Non disponible)';

    const isOwner = interaction.guild.ownerId === user.id;
    const isBooster = member.premiumSince !== null;
    const boostDate = isBooster ? Math.floor(member.premiumSinceTimestamp / 1000) : null;

    let badges = [];
    if (isOwner) badges.push('👑 Propriétaire');
    if (isBooster) badges.push(`💎 Booster (depuis <t:${boostDate}:R>)`);
    const badgesString = badges.length > 0 ? badges.join('\n') : 'Aucun';

    // 4. Permissions spéciales
    const keyPermissions = [
      { name: 'Administrateur', has: member.permissions.has(PermissionFlagsBits.Administrator) },
      { name: 'Gérer le serveur', has: member.permissions.has(PermissionFlagsBits.ManageGuild) },
      { name: 'Bannir des membres', has: member.permissions.has(PermissionFlagsBits.BanMembers) },
      { name: 'Expulser des membres', has: member.permissions.has(PermissionFlagsBits.KickMembers) }
    ];

    const permissionsString = keyPermissions
      .filter(p => p.has)
      .map(p => `✅ ${p.name}`)
      .join('\n') || 'Aucune permission spéciale';

    // Construction de l'embed
    const embed = createEmbed()
      .setTitle(`Informations sur ${user.username}`)
      .setThumbnail(avatarUrl)
      .setColor(highestRole.color || 0x780CED) // Couleur du rôle ou violet par défaut
      .addFields(
        {
          name: '👤 Utilisateur',
          value: `**Tag:** ${userTag}\n**ID:** ${userId}\n**Mention:** ${userMention}`,
          inline: false
        },
        {
          name: '🛡️ Membre',
          value: `**Surnom:** ${nickname}\n**Créé le:** <t:${createdTimestamp}:f> (<t:${createdTimestamp}:R>)\n**Rejoint le:** <t:${joinedTimestamp}:f> (<t:${joinedTimestamp}:R>)`,
          inline: false
        },
        {
          name: '🎭 Rôles',
          value: `**Plus haut:** ${highestRole}\n**Tous (${rolesCount}):** ${rolesDisplay}${rolesRemaining}`,
          inline: false
        },
        {
          name: '📊 Statut',
          value: `**État:** ${status}\n**Badges:**\n${badgesString}`,
          inline: true
        },
        {
          name: '🔐 Permissions Clés',
          value: permissionsString,
          inline: true
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
