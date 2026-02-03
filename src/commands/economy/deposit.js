const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Déposer de l\'argent à la banque')
    .addStringOption(option =>
      option.setName('montant')
        .setDescription('Le montant à déposer (ou "all"/"tout")')
        .setRequired(true)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const amountInput = interaction.options.getString('montant').toLowerCase();

    // Récupérer le portefeuille
    let wallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

    // Création automatique si inexistant
    if (!wallet) {
      db.run('INSERT INTO wallets (user_id, guild_id) VALUES (?, ?)', [userId, guildId]);
      wallet = { cash: 0, bank: 0 };
    }

    let amount = 0;

    // Parsing du montant
    if (['all', 'tout'].includes(amountInput)) {
      amount = wallet.cash;
    } else {
      amount = parseInt(amountInput, 10);
    }

    // Validation
    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        embeds: [errorEmbed('Veuillez spécifier un montant valide supérieur à 0.')],
        flags: MessageFlags.Ephemeral
      });
    }

    if (amount > wallet.cash) {
      return interaction.reply({
        embeds: [errorEmbed(`Vous n'avez pas assez d'argent liquide.\nSolde actuel : **${wallet.cash} ${economyConfig.CURRENCY_SYMBOL}**`)],
        flags: MessageFlags.Ephemeral
      });
    }

    // Transaction
    const timestamp = Math.floor(Date.now() / 1000);

    try {
      const deposit = db.transaction(() => {
        // Mise à jour du portefeuille
        db.run('UPDATE wallets SET cash = cash - ?, bank = bank + ? WHERE user_id = ? AND guild_id = ?',
          [amount, amount, userId, guildId]);

        // Log de la transaction
        db.run(
          'INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, userId, guildId, amount, 'DEPOSIT', timestamp]
        );
      });

      deposit();

      return interaction.reply({
        embeds: [successEmbed(`💳 Vous avez déposé **${amount} ${economyConfig.CURRENCY_SYMBOL}** à la banque.`)]
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
