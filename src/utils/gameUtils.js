const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { createEmbed } = require('./embedBuilder');

/**
 * Initiates a challenge between two users.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').User} opponent
 * @param {string} gameName
 * @returns {Promise<boolean>} True if accepted, False otherwise.
 */
async function initiateChallenge(interaction, opponent, gameName) {
    if (opponent.bot) {
        await interaction.reply({
            content: 'Vous ne pouvez pas jouer contre un bot !',
            flags: MessageFlags.Ephemeral
        });
        return false;
    }

    if (opponent.id === interaction.user.id) {
        await interaction.reply({
            content: 'Vous ne pouvez pas jouer contre vous-même !',
            flags: MessageFlags.Ephemeral
        });
        return false;
    }

    const embed = createEmbed()
        .setTitle(`⚔️ Défi : ${gameName}`)
        .setDescription(`${interaction.user} défie ${opponent} !\n\n${opponent}, acceptez-vous le défi ?`)
        .setColor('#FFA500'); // Orange for challenge

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('accept_challenge')
                .setLabel('Accepter')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('decline_challenge')
                .setLabel('Refuser')
                .setStyle(ButtonStyle.Danger)
        );

    const message = await interaction.reply({
        content: `${opponent}`,
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    try {
        const confirmation = await message.awaitMessageComponent({
            filter: i => i.user.id === opponent.id && ['accept_challenge', 'decline_challenge'].includes(i.customId),
            time: 60000,
            componentType: ComponentType.Button
        });

        if (confirmation.customId === 'accept_challenge') {
            await confirmation.update({
                content: `Le défi commence !`,
                embeds: [],
                components: []
            });
            return true;
        } else {
            await confirmation.update({
                content: `${opponent} a refusé le défi.`,
                embeds: [],
                components: []
            });
            return false;
        }
    } catch (e) {
        // If the interaction is already replied or deferred, editReply.
        // Note: awaitMessageComponent throws if time expires.
        await interaction.editReply({
            content: `Le défi a expiré (pas de réponse de ${opponent}).`,
            embeds: [],
            components: []
        });
        return false;
    }
}

module.exports = { initiateChallenge };
