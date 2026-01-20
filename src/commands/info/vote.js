const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Affiche les sites de vote pour soutenir le serveur'),

  async execute(interaction) {
    const guildId = interaction.guild.id;

    // Récupérer les sites de vote activés
    const sites = db.all(
      'SELECT * FROM vote_sites WHERE guild_id = ? AND enabled = 1 ORDER BY position ASC',
      [guildId]
    );

    if (!sites || sites.length === 0) {
      const warningEmbed = createEmbed()
        .setColor(0xFEE75C) // Jaune (Warning)
        .setDescription('⚠️ | Aucun site de vote n\'est configuré pour ce serveur.');

      return interaction.reply({
        embeds: [warningEmbed],
        flags: MessageFlags.Ephemeral
      });
    }

    // Création de l'embed principal
    const embed = createEmbed()
      .setTitle('🗳️ Voter pour Heneria')
      .setDescription(`Soutenez le serveur en votant sur les sites ci-dessous !

**Pourquoi voter ?**
• Aide le serveur à gagner en visibilité
• Récompenses exclusives à chaque vote
• C'est gratuit et rapide !`)
      .addFields({
        name: '📊 Sites de vote',
        value: sites.map((site, i) =>
          `${i + 1}. **[${site.name}](${site.url})**`
        ).join('\n').slice(0, 1024)
      })
      .setFooter({ text: 'Merci de votre soutien ! 💜' });

    // Création des boutons (5 max par ligne)
    const rows = [];
    let currentRow = new ActionRowBuilder();

    sites.forEach((site, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setLabel(site.name)
          .setURL(site.url)
          .setStyle(ButtonStyle.Link)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    await interaction.reply({
      embeds: [embed],
      components: rows
    });
  },
};
