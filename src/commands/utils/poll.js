const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../config/constants');
const { successEmbed, errorEmbed } = require('../../utils/embedBuilder');

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Créer un sondage simple')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('question')
        .setDescription('La question du sondage')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('options')
        .setDescription('Les options séparées par | (ex: Oui | Non | Peut-être)')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const question = interaction.options.getString('question');
      const optionsRaw = interaction.options.getString('options');

      const options = optionsRaw.split('|').map(opt => opt.trim()).filter(opt => opt.length > 0);

      if (options.length < 2) {
        return interaction.reply({
          embeds: [errorEmbed('Un sondage doit avoir au moins 2 options.')],
          ephemeral: true
        });
      }

      if (options.length > 10) {
        return interaction.reply({
          embeds: [errorEmbed('Vous ne pouvez pas mettre plus de 10 options.')],
          ephemeral: true
        });
      }

      let description = '';
      for (let i = 0; i < options.length; i++) {
        description += `${NUMBERS[i]} ${options[i]}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`📊 Sondage : ${question}`)
        .setDescription(description)
        .setFooter({ text: `Sondage par ${interaction.user.tag}` })
        .setTimestamp();

      const pollMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

      // Ajout des réactions séquentiellement
      // On ne 'await' pas la boucle entière pour ne pas bloquer le bot, mais on veut l'ordre.
      // fetchReply: true permet de récupérer l'objet message pour réagir.

      // Note: interaction.reply envoie le message. Si on veut réagir, il faut le faire sur l'objet message.

      const reactSequentially = async () => {
        try {
            for (let i = 0; i < options.length; i++) {
                await pollMessage.react(NUMBERS[i]);
            }
        } catch (err) {
            console.error('Erreur lors de l\'ajout des réactions au sondage:', err);
        }
      };

      // On lance la réaction en tâche de fond (ou on l'attend, mais 10 réactions c'est rapide)
      // Comme c'est la fin de la commande, on peut attendre.
      await reactSequentially();

    } catch (error) {
      console.error(error);
      // Si on a déjà répondu (pollMessage créé), on ne peut plus reply.
      if (!interaction.replied) {
          await interaction.reply({
            embeds: [errorEmbed('Une erreur est survenue lors de la création du sondage.')],
            ephemeral: true
          });
      }
    }
  },
};
