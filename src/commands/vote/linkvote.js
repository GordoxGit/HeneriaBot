const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('linkvote')
    .setDescription('Lier votre pseudo d\'un site de vote à votre compte Discord')
    .addStringOption(option =>
      option.setName('site')
        .setDescription('Le site de vote')
        .setRequired(true)
        .addChoices(
          { name: 'serveur-prive.net', value: 'serveur-prive.net' },
          { name: 'top-serveurs.net', value: 'top-serveurs.net' }
        ))
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Votre pseudo sur le site de vote')
        .setRequired(true)
        .setMaxLength(50)),

  async execute(interaction) {
    const site = interaction.options.getString('site');
    const username = interaction.options.getString('username').trim();

    try {
      // Vérifier si ce username est déjà lié à un autre utilisateur
      const existingLink = db.get(`
        SELECT user_id FROM vote_username_links
        WHERE guild_id = ? AND site_name = ? AND site_username = ? AND verified = 1
      `, [interaction.guildId, site, username]);

      if (existingLink && existingLink.user_id !== interaction.user.id) {
        return interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Pseudo déjà lié',
            description: `Le pseudo **${username}** est déjà lié à un autre utilisateur sur ${site}.`,
            footer: { text: 'Si c\'est votre pseudo, contactez un administrateur.' }
          }],
          flags: MessageFlags.Ephemeral
        });
      }

      // Générer un code de vérification à 6 caractères
      const verificationCode = this.generateVerificationCode();
      const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes

      // Supprimer toute liaison en attente précédente
      db.run(`
        DELETE FROM vote_username_links
        WHERE user_id = ? AND guild_id = ? AND site_name = ? AND verified = 0
      `, [interaction.user.id, interaction.guildId, site]);

      // Créer la nouvelle liaison en attente
      db.run(`
        INSERT INTO vote_username_links (
          user_id, guild_id, site_name, site_username,
          verification_code, verified, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        interaction.user.id,
        interaction.guildId,
        site,
        username,
        verificationCode,
        Date.now(),
        expiresAt
      ]);

      // Instructions pour l'utilisateur
      const embed = new EmbedBuilder()
        .setColor(0x780CED)
        .setTitle('🔗 Liaison de compte en attente')
        .setDescription(`Pour finaliser la liaison de votre compte **${site}**, suivez ces étapes :`)
        .addFields(
          {
            name: '1️⃣ Modifiez votre pseudo sur le site',
            value: `Ajoutez le code **${verificationCode}** à votre pseudo.\n` +
                   `Exemple : \`${username}_${verificationCode}\` ou \`${verificationCode}_${username}\``
          },
          {
            name: '2️⃣ Votez pour le serveur',
            value: `Votez sur ${site} avec ce pseudo modifié.`
          },
          {
            name: '3️⃣ Attendez la détection',
            value: 'Votre vote sera détecté automatiquement dans les 2 minutes.\n' +
                   'Vous recevrez une confirmation par DM.'
          }
        )
        .addFields(
          {
            name: '⏰ Expiration',
            value: `Ce code expire <t:${Math.floor(expiresAt / 1000)}:R>`,
            inline: true
          },
          {
            name: '🔗 Lien du site',
            value: this.getSiteVoteUrl(site),
            inline: true
          }
        )
        .setFooter({ text: 'Après vérification, vous pourrez remettre votre pseudo normal' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error('[linkvote] Erreur:', error);
      await interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Erreur',
          description: 'Une erreur est survenue lors de la création de la liaison.'
        }],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  /**
   * Génère un code de vérification aléatoire
   */
  generateVerificationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I, O, 0, 1 pour éviter confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  /**
   * Retourne l'URL de vote du site
   */
  getSiteVoteUrl(site) {
    const urls = {
      'serveur-prive.net': 'https://serveur-prive.net/hytale/heneria/vote',
      'top-serveurs.net': 'https://top-serveurs.net/hytale/heneria/vote'
    };
    return urls[site] || 'https://heneria.fr';
  }
};
