const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { logGeneralAction } = require('../../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprimer un nombre défini de messages.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Filtrer les messages par utilisateur')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');

    // Defer reply ephemerally
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;

    try {
      let messagesToDelete;

      if (targetUser) {
        // Fetch up to 100 messages to find the user's messages
        const messages = await channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter(m => m.author.id === targetUser.id);
        // Take up to 'amount' of the user's messages
        messagesToDelete = Array.from(userMessages.values()).slice(0, amount);
      } else {
        // Fetch exactly 'amount' messages
        const messages = await channel.messages.fetch({ limit: amount });
        messagesToDelete = Array.from(messages.values());
      }

      if (messagesToDelete.length === 0) {
           return interaction.editReply({ content: '❌ Aucun message trouvé à supprimer.' });
      }

      // bulkDelete with filterOld = true to ignore messages older than 14 days without error
      const deleted = await channel.bulkDelete(messagesToDelete, true);

      if (deleted.size === 0) {
         return interaction.editReply({ content: '❌ Aucun message supprimé. Les messages sont peut-être trop anciens (> 14 jours).' });
      }

      const logDetails = targetUser
        ? `${deleted.size} messages de ${targetUser.tag} supprimés.`
        : `${deleted.size} messages supprimés.`;

      await logGeneralAction(interaction.guild, interaction.user, 'CLEAR', logDetails, channel);

      await interaction.editReply({ content: `✅ ${logDetails}` });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: `❌ Une erreur est survenue : ${error.message}` });
    }
  },
};
