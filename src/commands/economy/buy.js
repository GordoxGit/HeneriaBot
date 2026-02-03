const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Acheter un article du magasin')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Nom ou ID de l\'article')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('Quantité à acheter')
        .setMinValue(1)
        .setRequired(false)),

  async execute(interaction) {
    const itemQuery = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // 1. Find the item
    let item;
    // Try as ID first if it looks like a number
    if (/^\d+$/.test(itemQuery)) {
        item = db.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [itemQuery, guildId]);
    }
    // If not found or not ID, try as name
    if (!item) {
        item = db.get('SELECT * FROM shop_items WHERE name = ? AND guild_id = ?', [itemQuery, guildId]);
        // Try partial match if exact match fails? Instructions say "Nom ou ID", implies exact or specific.
        // Let's stick to exact name or ID to avoid buying wrong things.
        // Actually, let's try case insensitive search for name
        if (!item) {
             item = db.get('SELECT * FROM shop_items WHERE LOWER(name) = LOWER(?) AND guild_id = ?', [itemQuery, guildId]);
        }
    }

    if (!item) {
        return interaction.reply({
            embeds: [errorEmbed('Article introuvable. Veuillez vérifier le nom ou l\'ID.')],
            ephemeral: true
        });
    }

    // 2. Check Stock
    if (item.stock !== -1 && item.stock < quantity) {
        return interaction.reply({
            embeds: [errorEmbed(`Stock insuffisant. Il ne reste que ${item.stock} exemplaires.`)],
            ephemeral: true
        });
    }

    // 3. Check Balance
    const totalPrice = item.price * quantity;
    const wallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

    if (!wallet || wallet.cash < totalPrice) {
        return interaction.reply({
            embeds: [errorEmbed(`Fonds insuffisants. Il vous faut ${totalPrice} ${economyConfig.CURRENCY_SYMBOL} (Vous avez ${wallet ? wallet.cash : 0}).`)],
            ephemeral: true
        });
    }

    // 4. Transaction execution
    try {
        const buyTx = db.transaction(() => {
            // Deduct money
            db.run('UPDATE wallets SET cash = cash - ? WHERE user_id = ? AND guild_id = ?', [totalPrice, userId, guildId]);

            // Deduct stock
            if (item.stock !== -1) {
                db.run('UPDATE shop_items SET stock = stock - ? WHERE id = ?', [quantity, item.id]);
            }

            // Add to inventory
            const inventoryItem = db.get('SELECT id FROM inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);
            if (inventoryItem) {
                db.run('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, inventoryItem.id]);
            } else {
                db.run('INSERT INTO inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [userId, guildId, item.id, quantity]);
            }

            // Log transaction
            db.run('INSERT INTO economy_transactions (from_user_id, guild_id, amount, type) VALUES (?, ?, ?, ?)', [userId, guildId, totalPrice, 'SHOP']);
        });

        buyTx();

    } catch (error) {
        console.error('Buy transaction failed:', error);
        return interaction.reply({
            embeds: [errorEmbed('Une erreur est survenue lors de la transaction.')],
            ephemeral: true
        });
    }

    // 5. Success Message & Role Assignment
    let roleMessage = '';
    if (item.role_id) {
        try {
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(item.role_id)) {
                await member.roles.add(item.role_id);
                roleMessage = `\n✅ Rôle <@&${item.role_id}> attribué !`;
            } else {
                roleMessage = `\nℹ️ Vous possédez déjà le rôle <@&${item.role_id}>.`;
            }
        } catch (error) {
            console.error('Role assignment failed:', error);
            roleMessage = `\n⚠️ Impossible de vous donner le rôle <@&${item.role_id}>. Veuillez contacter un administrateur.`;
        }
    }

    return interaction.reply({
        embeds: [successEmbed(`Vous avez acheté **${quantity}x ${item.name}** pour ${totalPrice} ${economyConfig.CURRENCY_SYMBOL}.${roleMessage}`)],
        ephemeral: false // Public purchase? Or ephemeral? User didn't specify. Usually purchases are private or public. "Ephemeral" avoids spam.
        // Prompt says "Logs : Enregistrer l'achat...", doesn't specify ephemeral. I'll make it visible so people can flex, or ephemeral if it fails.
        // Let's make it visible but short.
    });
  }
};
