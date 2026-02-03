const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createEmbed, successEmbed, errorEmbed } = require('../../utils/embedBuilder');
const db = require('../../database/db');
const economyConfig = require('../../config/economy');
const { COLORS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Système de magasin')
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('Voir le magasin'))
    .addSubcommandGroup(group =>
        group
            .setName('admin')
            .setDescription('Gestion du magasin (Admin)')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Ajouter un article')
                    .addStringOption(option => option.setName('name').setDescription('Nom de l\'article').setRequired(true))
                    .addIntegerOption(option => option.setName('price').setDescription('Prix de l\'article').setRequired(true))
                    .addStringOption(option => option.setName('description').setDescription('Description de l\'article').setRequired(true))
                    .addRoleOption(option => option.setName('role').setDescription('Rôle à donner (optionnel)').setRequired(false))
                    .addIntegerOption(option => option.setName('stock').setDescription('Stock (-1 pour infini)').setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Supprimer un article')
                    .addIntegerOption(option => option.setName('item_id').setDescription('ID de l\'article').setRequired(true)))),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommandGroup === 'admin') {
        // Permissions check
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [errorEmbed('Vous n\'avez pas la permission de gérer le magasin.')],
                ephemeral: true
            });
        }

        if (subcommand === 'add') {
            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const description = interaction.options.getString('description');
            const role = interaction.options.getRole('role');
            const stock = interaction.options.getInteger('stock') ?? -1;

            const roleId = role ? role.id : null;

            try {
                db.run(
                    'INSERT INTO shop_items (guild_id, name, description, price, role_id, stock) VALUES (?, ?, ?, ?, ?, ?)',
                    [guildId, name, description, price, roleId, stock]
                );

                const embed = successEmbed(`**${name}** a été ajouté au magasin pour ${price} ${economyConfig.CURRENCY_SYMBOL}.`)
                    .setTitle('Article ajouté')
                    .addFields(
                        { name: 'Description', value: description },
                        { name: 'Stock', value: stock === -1 ? 'Infini' : stock.toString(), inline: true },
                        { name: 'Rôle', value: role ? `<@&${roleId}>` : 'Aucun', inline: true }
                    );

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error(error);
                return interaction.reply({
                    embeds: [errorEmbed('Une erreur est survenue lors de l\'ajout de l\'article.')],
                    ephemeral: true
                });
            }
        } else if (subcommand === 'remove') {
            const itemId = interaction.options.getInteger('item_id');
            const item = db.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [itemId, guildId]);

            if (!item) {
                return interaction.reply({
                    embeds: [errorEmbed('Article introuvable.')],
                    ephemeral: true
                });
            }

            try {
                const deleteItem = db.transaction((id) => {
                    // Supprimer les références dans l'inventaire
                    db.run('DELETE FROM inventory WHERE item_id = ?', [id]);
                    // Supprimer les références dans les recettes (résultat)
                    db.run('DELETE FROM recipes WHERE result_item_id = ?', [id]);
                    // Supprimer l'article
                    db.run('DELETE FROM shop_items WHERE id = ?', [id]);
                });

                deleteItem(itemId);

                return interaction.reply({
                    embeds: [successEmbed(`L'article **${item.name}** (ID: ${itemId}) a été supprimé.`)],
                    ephemeral: true
                });
            } catch (error) {
                console.error(error);
                return interaction.reply({
                    embeds: [errorEmbed('Une erreur est survenue lors de la suppression de l\'article.')],
                    ephemeral: true
                });
            }
        }
    } else if (subcommand === 'view') {
        const items = db.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);

        if (items.length === 0) {
            return interaction.reply({
                embeds: [createEmbed().setTitle('Magasin').setDescription('Le magasin est vide pour le moment.').setColor(COLORS.INFO)],
                ephemeral: true
            });
        }

        // Pagination Logic
        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentItems = items.slice(start, end);

            const embed = createEmbed()
                .setTitle(`🛒 Magasin - Page ${page + 1}/${totalPages}`)
                .setColor(COLORS.PRIMARY);

            if (currentItems.length > 0) {
                const fields = currentItems.map(item => {
                    const stockDisplay = item.stock === -1 ? '♾️ Infini' : `📦 ${item.stock}`;
                    const roleDisplay = item.role_id ? `\n🏷️ Donne le rôle: <@&${item.role_id}>` : '';
                    return {
                        name: `[${item.id}] ${item.name} - ${item.price} ${economyConfig.CURRENCY_SYMBOL}`,
                        value: `📝 ${item.description}\n${stockDisplay}${roleDisplay}`
                    };
                });
                embed.addFields(fields);
            }
            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(totalPages === 1)
        );

        await interaction.reply({
            embeds: [generateEmbed(0)],
            components: totalPages > 1 ? [row] : [],
        });

        const response = await interaction.fetchReply();

        if (totalPages > 1) {
            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'Vous ne pouvez pas utiliser ces boutons.', ephemeral: true });
                }

                if (i.customId === 'prev') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                }

                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages - 1)
                );

                await i.update({ embeds: [generateEmbed(currentPage)], components: [newRow] });
            });

            collector.on('end', () => {
                 const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(true)
                );
                 response.edit({ components: [disabledRow] }).catch(() => {});
            });
        }
    }
  }
};
