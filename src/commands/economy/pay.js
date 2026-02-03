const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Envoyer de l\'argent à un autre utilisateur')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('L\'utilisateur à qui envoyer de l\'argent')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('montant')
        .setDescription('Le montant à envoyer')
        .setMinValue(1)
        .setRequired(true)),

  async execute(interaction) {
    const sender = interaction.user;
    const receiver = interaction.options.getUser('utilisateur');
    const amount = interaction.options.getInteger('montant');
    const guildId = interaction.guildId;

    // Checks
    if (sender.id === receiver.id) {
      return interaction.reply({
        embeds: [errorEmbed('Vous ne pouvez pas vous envoyer de l\'argent à vous-même.')],
        flags: MessageFlags.Ephemeral
      });
    }

    if (receiver.bot) {
      return interaction.reply({
        embeds: [errorEmbed('Vous ne pouvez pas envoyer de l\'argent à un bot.')],
        flags: MessageFlags.Ephemeral
      });
    }

    // Get sender wallet
    let senderWallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [sender.id, guildId]);
    if (!senderWallet || senderWallet.cash < amount) {
      const balance = senderWallet ? senderWallet.cash : 0;
      return interaction.reply({
        embeds: [errorEmbed(`Vous n'avez pas assez d'argent liquide.\nSolde actuel : **${balance} ${economyConfig.CURRENCY_SYMBOL}**`)],
        flags: MessageFlags.Ephemeral
      });
    }

    // Ensure receiver wallet exists
    let receiverWallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [receiver.id, guildId]);
    if (!receiverWallet) {
      db.run('INSERT INTO wallets (user_id, guild_id) VALUES (?, ?)', [receiver.id, guildId]);
    }

    // Perform transaction
    const timestamp = Math.floor(Date.now() / 1000);

    try {
        const transfer = db.transaction(() => {
            db.run('UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?', [amount, sender.id, guildId]);
            db.run('UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?', [amount, receiver.id, guildId]);
            db.run(
                'INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [sender.id, receiver.id, guildId, amount, 'PAY', timestamp]
            );
        });

        transfer();

        return interaction.reply({
            embeds: [successEmbed(`Vous avez envoyé **${amount} ${economyConfig.CURRENCY_SYMBOL}** à ${receiver}.`)]
        });
    } catch (error) {
        console.error(error);
        return interaction.reply({
            embeds: [errorEmbed('Une erreur est survenue lors de la transaction.')],
            flags: MessageFlags.Ephemeral
        });
    }
  }
};
