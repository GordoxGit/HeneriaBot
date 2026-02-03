const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { successEmbed, errorEmbed, warningEmbed, infoEmbed } = require('../../utils/embedBuilder');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco')
    .setDescription('Administration de l\'économie')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Donner de l\'argent à un utilisateur')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Montant').setMinValue(1).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('take')
        .setDescription('Retirer de l\'argent à un utilisateur')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Montant').setMinValue(1).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Définir le solde exact d\'un utilisateur')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Montant').setMinValue(0).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Réinitialiser le compte d\'un utilisateur')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reset_all')
        .setDescription('Réinitialiser TOUTE l\'économie du serveur (DANGER)')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const moderator = interaction.user;
    const timestamp = Math.floor(Date.now() / 1000);

    // Helper to ensure wallet exists
    const ensureWallet = (userId) => {
        let wallet = db.get('SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
        if (!wallet) {
            db.run('INSERT INTO wallets (user_id, guild_id) VALUES (?, ?)', [userId, guildId]);
            return { cash: 0, bank: 0 };
        }
        return wallet;
    };

    if (sub === 'give') {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        ensureWallet(target.id);

        db.transaction(() => {
            db.run('UPDATE wallets SET cash = cash + ? WHERE user_id = ? AND guild_id = ?', [amount, target.id, guildId]);
            db.run('INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [moderator.id, target.id, guildId, amount, 'ADMIN_GIVE', timestamp]);
        })();

        await logGeneralAction(interaction.guild, moderator, 'ECONOMY', `A donné ${amount} ${economyConfig.CURRENCY_SYMBOL} à ${target.tag}.`);

        return interaction.reply({ embeds: [successEmbed(`Donné **${amount} ${economyConfig.CURRENCY_SYMBOL}** à ${target}.`)] });
    }

    if (sub === 'take') {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        ensureWallet(target.id);

        db.transaction(() => {
            db.run('UPDATE wallets SET cash = MAX(0, cash - ?) WHERE user_id = ? AND guild_id = ?', [amount, target.id, guildId]);
            db.run('INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [moderator.id, target.id, guildId, amount, 'ADMIN_TAKE', timestamp]);
        })();

        await logGeneralAction(interaction.guild, moderator, 'ECONOMY', `A retiré ${amount} ${economyConfig.CURRENCY_SYMBOL} à ${target.tag}.`);

        return interaction.reply({ embeds: [successEmbed(`Retiré **${amount} ${economyConfig.CURRENCY_SYMBOL}** à ${target}.`)] });
    }

    if (sub === 'set') {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        ensureWallet(target.id);

        db.transaction(() => {
            db.run('UPDATE wallets SET cash = ? WHERE user_id = ? AND guild_id = ?', [amount, target.id, guildId]);
            db.run('INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [moderator.id, target.id, guildId, amount, 'ADMIN_SET', timestamp]);
        })();

        await logGeneralAction(interaction.guild, moderator, 'ECONOMY', `A défini le solde de ${target.tag} à ${amount} ${economyConfig.CURRENCY_SYMBOL}.`);

        return interaction.reply({ embeds: [successEmbed(`Solde de ${target} défini à **${amount} ${economyConfig.CURRENCY_SYMBOL}**.`)] });
    }

    if (sub === 'reset') {
        const target = interaction.options.getUser('user');

        db.transaction(() => {
            db.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [target.id, guildId]);
            db.run('DELETE FROM inventory WHERE user_id = ? AND guild_id = ?', [target.id, guildId]);
            db.run('INSERT INTO economy_transactions (from_user_id, to_user_id, guild_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [moderator.id, target.id, guildId, 0, 'ADMIN_RESET', timestamp]);
        })();

        await logGeneralAction(interaction.guild, moderator, 'ECONOMY', `A réinitialisé le compte de ${target.tag}.`);

        return interaction.reply({ embeds: [successEmbed(`Compte de ${target} réinitialisé.`)] });
    }

    if (sub === 'reset_all') {
        const confirmId = `eco_reset_all_confirm_${interaction.id}`;
        const cancelId = `eco_reset_all_cancel_${interaction.id}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(confirmId)
                    .setLabel('CONFIRMER LE RESET GLOBAL')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(cancelId)
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary)
            );

        const reply = await interaction.reply({
            embeds: [warningEmbed('⚠️ **ATTENTION** ⚠️\nVous êtes sur le point de réinitialiser **TOUTE** l\'économie du serveur (Argent, Inventaires).\nCette action est irréversible.\nÊtes-vous sûr ?')],
            components: [row],
            flags: MessageFlags.Ephemeral,
            fetchReply: true
        });

        const filter = i => i.user.id === interaction.user.id && [confirmId, cancelId].includes(i.customId);

        try {
            const confirmation = await reply.awaitMessageComponent({ filter, time: 15000, componentType: ComponentType.Button });

            if (confirmation.customId === confirmId) {
                db.transaction(() => {
                    db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
                    db.run('DELETE FROM inventory WHERE guild_id = ?', [guildId]);
                    // We don't log a transaction row for GLOBAL reset, just an action log
                })();

                await logGeneralAction(interaction.guild, moderator, 'ECONOMY_RESET', 'A réinitialisé toute l\'économie du serveur.');

                await confirmation.update({
                    embeds: [successEmbed('L\'économie du serveur a été entièrement réinitialisée.')],
                    components: []
                });
            } else {
                await confirmation.update({
                    embeds: [infoEmbed('Opération annulée.')],
                    components: []
                });
            }
        } catch (e) {
            // Check if error is timeout
            try {
                await interaction.editReply({
                    embeds: [infoEmbed('Temps écoulé, opération annulée.')],
                    components: []
                });
            } catch (err) {
                // Interaction might be gone or unknown
            }
        }
    }
  }
};
