/**
 * Commande /balance
 * Affiche le solde d'un utilisateur
 */

const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Affiche votre solde ou celui d\'un autre utilisateur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur dont vous voulez voir le solde')
        .setRequired(false)),

  /**
   * Exécute la commande
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    // Récupérer le portefeuille
    let wallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [target.id, guildId]);

    // Création automatique si inexistant
    if (!wallet) {
      db.run('INSERT INTO wallets (user_id, guild_id) VALUES (?, ?)', [target.id, guildId]);
      wallet = { cash: 0, bank: 0 };
    }

    const total = wallet.cash + wallet.bank;

    // Calcul du rang
    // Le rang est le nombre de personnes ayant strictement plus d'argent + 1
    const rankQuery = db.get(
      'SELECT COUNT(*) as count FROM wallets WHERE guild_id = ? AND (cash + bank) > ?',
      [guildId, total]
    );
    const rank = rankQuery.count + 1;

    const embed = createEmbed()
      .setAuthor({ name: `Solde de ${target.username}`, iconURL: target.displayAvatarURL() })
      .addFields(
        {
          name: '💵 Espèces',
          value: `${wallet.cash} ${economyConfig.CURRENCY_SYMBOL}`,
          inline: true
        },
        {
          name: '🏦 Banque',
          value: `${wallet.bank} ${economyConfig.CURRENCY_SYMBOL}`,
          inline: true
        },
        {
          name: '💰 Total',
          value: `${total} ${economyConfig.CURRENCY_SYMBOL}`,
          inline: true
        }
      )
      .setFooter({ text: `Rang #${rank} • ${economyConfig.CURRENCY_NAME}` });

    await interaction.reply({ embeds: [embed] });
  },
};
