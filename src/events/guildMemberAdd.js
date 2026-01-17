/**
 * Événement GuildMemberAdd
 * Se déclenche lorsqu'un nouveau membre rejoint un serveur.
 */

const { Events, AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { generateWelcomeCard } = require('../utils/welcomeCard');
const { createEmbed } = require('../utils/embedBuilder');

// ID du salon à hardcoder (remplacer par un vrai ID)
// TODO: Remplacer par l'ID réel du salon de bienvenue
const WELCOME_CHANNEL_ID = 'YOUR_CHANNEL_ID_HERE';

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
      // 1. Génération de la carte de bienvenue
      let attachment = null;
      try {
        const imageBuffer = await generateWelcomeCard(member, member.guild.name);
        attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
      } catch (imageError) {
        logger.error(`⚠️ Erreur lors de la génération de la carte de bienvenue : ${imageError.message}`);
        // On continue sans l'image
      }

      // 2. Création de l'embed
      const embed = createEmbed()
        .setColor(0x780CED) // Violet Heneria
        .setDescription(`Bienvenue ${member} sur **${member.guild.name}** ! 🎉\nNous sommes maintenant **${member.guild.memberCount}** membres !`)
        .setFooter({ text: 'Bienvenue sur Heneria' });

      // 3. Récupération du salon
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

      if (!channel) {
        logger.error(`❌ Salon de bienvenue introuvable (ID: ${WELCOME_CHANNEL_ID})`);
        return;
      }

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
  },
};
