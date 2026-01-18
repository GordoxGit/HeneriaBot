const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche les informations détaillées du serveur'),

  async execute(interaction) {
    const { guild } = interaction;

    // Assurer que toutes les données sont chargées
    // Note: fetching all members might be expensive on large guilds and requires intents
    // We will use cache where possible, but for owner we might need fetch if not in cache
    await guild.fetch();

    const owner = await guild.fetchOwner();

    // Stats des membres
    const totalMembers = guild.memberCount;
    // Note: Sans l'intent GUILD_PRESENCES, presences cache est vide/partiel.
    // On fait de notre mieux avec le cache.
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount; // Approximation si le cache n'est pas complet, sinon guild.members.cache.filter(m => !m.user.bot).size

    // Stats des salons
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const totalChannels = channels.size;

    // Stats des emojis
    const emojis = guild.emojis.cache;
    const staticEmojis = emojis.filter(e => !e.animated).size;
    const animatedEmojis = emojis.filter(e => e.animated).size;

    // Stats des rôles
    const roles = guild.roles.cache;
    const sortedRoles = [...roles.values()].sort((a, b) => b.position - a.position);
    const highestRole = sortedRoles.length > 0 ? sortedRoles[0] : 'Aucun';

    // Niveaux de vérification
    const verificationLevels = {
      0: 'Aucune',
      1: 'Faible',
      2: 'Moyen',
      3: 'Élevé',
      4: 'Très élevé'
    };

    // Niveaux de notifications
    const notificationLevels = {
      0: 'Tous les messages',
      1: 'Mentions seulement'
    };

    const embed = createEmbed()
      .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
      .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
      .addFields(
        {
          name: '🆔 Identification',
          value: `**Nom:** ${guild.name}\n**ID:** ${guild.id}\n**Propriétaire:** ${owner} (${owner.user.tag})`,
          inline: false
        },
        {
          name: '📅 Dates',
          value: `**Créé le:** <t:${Math.floor(guild.createdTimestamp / 1000)}:f> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
          inline: false
        },
        {
          name: '👥 Membres',
          value: `**Total:** ${totalMembers}\n**Humains:** ${humanCount} (approx)\n**Bots:** ${botCount}\n**En ligne:** ${onlineMembers} (🟢)`,
          inline: true
        },
        {
          name: '💬 Salons',
          value: `**Total:** ${totalChannels}\n**Texte:** ${textChannels}\n**Vocal:** ${voiceChannels}\n**Catégories:** ${categories}`,
          inline: true
        },
        {
          name: '🛡️ Rôles & Emojis',
          value: `**Rôles:** ${roles.size}\n**Plus haut:** ${highestRole}\n**Emojis:** ${emojis.size} (${staticEmojis} statiques, ${animatedEmojis} animés)`,
          inline: true
        },
        {
          name: '🚀 Boosts',
          value: `**Niveau:** ${guild.premiumTier}\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
          inline: true
        },
        {
          name: '⚙️ Configuration',
          value: `**Vérification:** ${verificationLevels[guild.verificationLevel]}\n**Notifs:** ${notificationLevels[guild.defaultMessageNotifications]}`,
          inline: true
        }
      );

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    await interaction.reply({ embeds: [embed] });
  },
};
