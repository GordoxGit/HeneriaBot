const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mylinks')
    .setDescription('Voir vos liaisons de comptes sur les sites de vote'),

  async execute(interaction) {
    try {
      const links = db.all(`
        SELECT site_name, site_username, verified, created_at, verified_at, expires_at, verification_code
        FROM vote_username_links
        WHERE user_id = ? AND guild_id = ?
        ORDER BY site_name
      `, [interaction.user.id, interaction.guildId]);

      if (links.length === 0) {
        return interaction.reply({
          embeds: [{
            color: 0x780CED,
            title: '🔗 Vos liaisons de vote',
            description: 'Vous n\'avez aucune liaison active.\n\n' +
                         'Utilisez `/linkvote` pour lier votre pseudo à un site de vote.'
          }],
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x780CED)
        .setTitle('🔗 Vos liaisons de vote')
        .setDescription(`Vous avez **${links.length}** liaison(s) configurée(s) :`);

      for (const link of links) {
        const status = link.verified
          ? `✅ Vérifiée le <t:${Math.floor(link.verified_at / 1000)}:D>`
          : link.expires_at < Date.now()
            ? `❌ Expirée (code : ${link.verification_code})`
            : `⏳ En attente (code : **${link.verification_code}**)\nExpire <t:${Math.floor(link.expires_at / 1000)}:R>`;

        embed.addFields({
          name: `${link.site_name}`,
          value: `**Pseudo :** ${link.site_username}\n**Statut :** ${status}`,
          inline: false
        });
      }

      embed.setFooter({ text: 'Utilisez /unlinkvote pour supprimer une liaison' });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error('[mylinks] Erreur:', error);
      await interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Erreur',
          description: 'Une erreur est survenue.'
        }],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
