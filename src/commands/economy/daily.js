const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { successEmbed, infoEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Récupérez votre récompense quotidienne'),

  async execute(interaction) {
    const user = interaction.user;
    const guildId = interaction.guildId;
    const timestamp = Math.floor(Date.now() / 1000);

    // Get wallet
    let wallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [user.id, guildId]);

    // Create wallet if it doesn't exist
    if (!wallet) {
      db.run('INSERT INTO wallets (user_id, guild_id) VALUES (?, ?)', [user.id, guildId]);
      wallet = { cash: 0, bank: 0, last_daily: 0 };
    }

    // Check cooldown
    const lastDaily = wallet.last_daily || 0;
    const cooldown = economyConfig.DAILY_COOLDOWN;
    const nextDaily = lastDaily + cooldown;

    if (timestamp < nextDaily) {
      return interaction.reply({
        embeds: [infoEmbed(`Vous avez déjà récupéré votre récompense quotidienne.\nRevenez <t:${nextDaily}:R>.`)],
        flags: MessageFlags.Ephemeral
      });
    }

    // Give reward
    const reward = economyConfig.DAILY_REWARD;
    db.run('UPDATE wallets SET cash = cash + ?, last_daily = ? WHERE user_id = ? AND guild_id = ?', [reward, timestamp, user.id, guildId]);

    // Log transaction
    db.run(
      'INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['SYSTEM', user.id, guildId, reward, 'REWARD', timestamp]
    );

    const newBalance = wallet.cash + reward;

    return interaction.reply({
      embeds: [successEmbed(`Vous avez reçu **${reward} ${economyConfig.CURRENCY_SYMBOL}** !\nNouveau solde : **${newBalance} ${economyConfig.CURRENCY_SYMBOL}**`)]
    });
  }
};
