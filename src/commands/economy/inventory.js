const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Voir votre inventaire ou celui d\'un autre utilisateur')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('L\'utilisateur dont vous voulez voir l\'inventaire')
        .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    const inventory = db.all(
        `SELECT i.quantity, s.name, s.price, s.description
         FROM inventory i
         JOIN shop_items s ON i.item_id = s.id
         WHERE i.user_id = ? AND i.guild_id = ?`,
        [target.id, guildId]
    );

    if (!inventory || inventory.length === 0) {
        return interaction.reply({
            embeds: [createEmbed().setDescription('🎒 Ce sac à dos est vide.').setTitle(`Inventaire de ${target.username}`)],
            ephemeral: false // Inventory is usually public info in many bots, but let's keep it visible.
        });
    }

    let totalValue = 0;
    const fields = inventory.map(item => {
        const itemTotal = item.price * item.quantity;
        totalValue += itemTotal;
        return {
            name: `${item.quantity}x ${item.name}`,
            value: `Valeur: ${itemTotal} ${economyConfig.CURRENCY_SYMBOL}`,
            inline: true
        };
    });

    let displayFields = fields;
    if (fields.length > 25) {
        displayFields = fields.slice(0, 24);
        displayFields.push({
            name: `... et ${fields.length - 24} autres objets`,
            value: 'Inventaire trop plein pour tout afficher.',
            inline: false
        });
    }

    const embed = createEmbed()
        .setTitle(`🎒 Inventaire de ${target.username}`)
        .addFields(displayFields)
        .setFooter({ text: `Valeur totale: ${totalValue} ${economyConfig.CURRENCY_NAME}` })
        .setColor(COLORS.PRIMARY);

    return interaction.reply({
        embeds: [embed]
    });
  }
};
