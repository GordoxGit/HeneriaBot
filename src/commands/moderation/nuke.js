const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Supprimer et recréer le salon actuel (RAZ).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.channel;

    if (!channel.clone) {
         return interaction.reply({ content: '❌ Ce type de salon ne peut pas être nuké.', flags: MessageFlags.Ephemeral });
    }

    const confirmButton = new ButtonBuilder()
        .setCustomId('nuke_confirm')
        .setLabel('OUI, NUKER')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('nuke_cancel')
        .setLabel('NON, ANNULER')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const response = await interaction.reply({
        content: '⚠️ **ATTENTION** : Cette commande va supprimer ce salon et le recréer. Tout l\'historique sera perdu. Êtes-vous sûr ?',
        components: [row],
        flags: MessageFlags.Ephemeral,
        fetchReply: true
    });

    const collector = response.createMessageComponentCollector({ time: 15000 });

    collector.on('collect', async i => {
        if (i.customId === 'nuke_cancel') {
            await i.update({ content: '❌ Opération annulée.', components: [] });
            return;
        }

        if (i.customId === 'nuke_confirm') {
            await i.update({ content: '☢️ Lancement du nuke...', components: [] });

            try {
                const position = channel.position;

                const newChannel = await channel.clone();
                await newChannel.setPosition(position);

                await channel.delete(`Nuke command executed by ${interaction.user.tag}`);

                await newChannel.send({
                    content: '☢️ Salon nuké avec succès.\nhttps://media1.tenor.com/m/X9kF3_Ht4yAAAAAd/explosion-mushroom-cloud.gif'
                });

                await logGeneralAction(interaction.guild, interaction.user, 'NUKE', 'Le salon a été recréé.', newChannel);

            } catch (error) {
                console.error('Error during nuke:', error);
            }
        }
    });
  },
};
