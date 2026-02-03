const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('baltop')
    .setDescription('Affiche le classement des utilisateurs les plus riches'),

  async execute(interaction) {
    const guildId = interaction.guildId;

    // Fetch top 10
    const topUsers = db.all(
      'SELECT user_id, (cash + bank) as total FROM wallets WHERE guild_id = ? ORDER BY total DESC LIMIT 10',
      [guildId]
    );

    if (topUsers.length === 0) {
      return interaction.reply({
        embeds: [createEmbed().setDescription('Aucun utilisateur n\'a de portefeuille pour le moment.')]
      });
    }

    const embed = createEmbed()
      .setTitle(`🏆 Classement Économique - ${economyConfig.CURRENCY_NAME}`);

    let description = '';

    // We need to fetch user tags. This is async.
    const lines = await Promise.all(topUsers.map(async (entry, index) => {
      let username = 'Utilisateur Inconnu';
      try {
        const user = await interaction.client.users.fetch(entry.user_id);
        username = user.username;
      } catch (e) {
        // Keep default
      }

      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

      return `${medal} **${username}** : ${entry.total} ${economyConfig.CURRENCY_SYMBOL}`;
    }));

    description = lines.join('\n');
    embed.setDescription(description);

    // Check if caller is in top 10
    const callerId = interaction.user.id;
    const isInTop10 = topUsers.some(u => u.user_id === callerId);

    if (!isInTop10) {
      // Calculate caller rank
      const wallet = db.get('SELECT (cash + bank) as total FROM wallets WHERE user_id = ? AND guild_id = ?', [callerId, guildId]);
      if (wallet) {
        const rankQuery = db.get(
          'SELECT COUNT(*) as count FROM wallets WHERE guild_id = ? AND (cash + bank) > ?',
          [guildId, wallet.total]
        );
        const rank = rankQuery.count + 1;
        embed.setFooter({ text: `Vous êtes classé #${rank} avec ${wallet.total} ${economyConfig.CURRENCY_SYMBOL}` });
      } else {
         embed.setFooter({ text: `Vous n'êtes pas encore classé.` });
      }
    }

    return interaction.reply({ embeds: [embed] });
  }
};
