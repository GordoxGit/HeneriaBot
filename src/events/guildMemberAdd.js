/**
 * Événement GuildMemberAdd
 * Se déclenche lorsqu'un nouveau membre rejoint un serveur.
 */

const { Events, AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { generateWelcomeCard } = require('../utils/welcomeCard');
const { createEmbed } = require('../utils/embedBuilder');
const db = require('../database/db');
const { updateMemberCounter } = require('../utils/memberCounter');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  /**
   * Exécute l'événement
   * @param {import('discord.js').GuildMember} member
   */
  async execute(member) {
    logger.info(`👋 Nouveau membre : ${member.user.tag} (ID: ${member.id})`);

    try {
      // 0. Récupérer la configuration
      const config = db.get('SELECT * FROM welcome_config WHERE guild_id = ?', [member.guild.id]);

      // Si pas de config ou pas de channel, on arrête
      if (!config || !config.channel_id) {
          logger.info(`ℹ️ Pas de configuration de bienvenue pour le serveur ${member.guild.name}`);
          return;
      }

      const channel = member.guild.channels.cache.get(config.channel_id);
      if (!channel) {
        logger.error(`❌ Salon de bienvenue introuvable (ID: ${config.channel_id})`);
        return;
      }

      // 1. Préparation du message
      let messageContent = config.message || "Bienvenue {user} sur **{server}** ! 🎉\nNous sommes maintenant **{memberCount}** membres !";

      messageContent = messageContent
        .replace(/{user}/g, member.toString())
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{memberCount}/g, member.guild.memberCount.toString());

      // 2. Génération de la carte de bienvenue
      let attachment = null;
      try {
        const imageBuffer = await generateWelcomeCard(member, member.guild.name);
        attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
      } catch (imageError) {
        logger.error(`⚠️ Erreur lors de la génération de la carte de bienvenue : ${imageError.message}`);
        // On continue sans l'image
      }

      // 3. Création de l'embed
      const embed = createEmbed()
        .setColor(0x780CED) // Violet Heneria
        .setDescription(messageContent)
        .setFooter({ text: 'Bienvenue sur Heneria' });

      // 4. Envoi du message
      const messagePayload = {
        content: `${member}`, // Mention le membre
        embeds: [embed]
      };

      if (attachment) {
        messagePayload.files = [attachment];
      }

      await channel.send(messagePayload);

      logger.info(`✅ Carte de bienvenue envoyée pour ${member.user.tag}`);

    } catch (error) {
      logger.error(`❌ Erreur lors de l'envoi de la carte de bienvenue : ${error.message}`);
      // On loggue aussi l'erreur complète pour le debug
      console.error(error);
    }

    // 5. Mise à jour du compteur de membres
    await updateMemberCounter(member.guild);
  },
};
