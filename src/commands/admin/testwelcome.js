/**
 * Commande /testwelcome
 * Teste la carte de bienvenue
 */

const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const { generateWelcomeCard } = require('../../utils/welcomeCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testwelcome')
    .setDescription('Teste la carte de bienvenue avec votre profil')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Récupérer la config
      const config = db.get('SELECT * FROM welcome_config WHERE guild_id = ?', [interaction.guild.id]);

      let targetChannel = interaction.channel;
      let usingConfiguredChannel = false;

      if (config && config.channel_id) {
        const channel = interaction.guild.channels.cache.get(config.channel_id);
        if (channel) {
            targetChannel = channel;
            usingConfiguredChannel = true;
        }
      }

      // 2. Générer le message
      let messageContent = config?.message || "Bienvenue {user} sur **{server}** ! 🎉\nNous sommes maintenant **{memberCount}** membres !";

      messageContent = messageContent
        .replace(/{user}/g, interaction.user.toString())
        .replace(/{username}/g, interaction.user.username)
        .replace(/{server}/g, interaction.guild.name)
        .replace(/{memberCount}/g, interaction.guild.memberCount.toString());

      // 3. Générer la carte
      // generateWelcomeCard attend (member, guildName)
      const imageBuffer = await generateWelcomeCard(interaction.member, interaction.guild.name);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });

      // 4. Créer l'embed
      const welcomeEmbed = createEmbed()
        .setColor(0x780CED)
        .setDescription(messageContent)
        .setFooter({ text: 'Bienvenue sur Heneria' });

      // 5. Envoyer
      const payload = {
        content: interaction.user.toString(),
        embeds: [welcomeEmbed],
        files: [attachment]
      };

      if (usingConfiguredChannel && targetChannel.id !== interaction.channel.id) {
          await targetChannel.send(payload);
          await interaction.editReply({
              embeds: [successEmbed(`Test envoyé dans ${targetChannel} !`)]
          });
      } else {
          // Si pas de config ou même salon, on envoie le message dans le salon
          await targetChannel.send(payload);
          await interaction.editReply({
              embeds: [successEmbed('Test généré !')]
          });
      }

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed('Erreur lors du test : ' + error.message)]
      });
    }
  },
};
