const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Retirer de l\'argent de la banque')
    .addStringOption(option =>
      option.setName('montant')
        .setDescription('Le montant à retirer (ou "all"/"tout")')
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
      amount = wallet.bank;
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

    if (amount > wallet.bank) {
      return interaction.reply({
        embeds: [errorEmbed(`Vous n'avez pas assez d'argent en banque.\nSolde bancaire actuel : **${wallet.bank} ${economyConfig.CURRENCY_SYMBOL}**`)],
        flags: MessageFlags.Ephemeral
      });
    }

    // Transaction
    const timestamp = Math.floor(Date.now() / 1000);

    try {
      const withdraw = db.transaction(() => {
        // Mise à jour du portefeuille
        db.run('UPDATE wallets SET bank = bank - ?, cash = cash + ? WHERE user_id = ? AND guild_id = ?',
          [amount, amount, userId, guildId]);

        // Log de la transaction
        db.run(
          'INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, userId, guildId, amount, 'WITHDRAW', timestamp]
        );
      });

      withdraw();

      return interaction.reply({
        embeds: [successEmbed(`💸 Vous avez retiré **${amount} ${economyConfig.CURRENCY_SYMBOL}** de la banque.`)]
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
