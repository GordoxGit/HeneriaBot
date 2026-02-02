const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('Ajouter ou retirer un rôle en masse')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajouter un rôle en masse')
        .addRoleOption(option => option.setName('role').setDescription('Le rôle à ajouter').setRequired(true))
        .addStringOption(option =>
          option.setName('target')
            .setDescription('La cible')
            .setRequired(true)
            .addChoices(
              { name: 'Tout le monde', value: 'everyone' },
              { name: 'Humains', value: 'humans' },
              { name: 'Bots', value: 'bots' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retirer un rôle en masse')
        .addRoleOption(option => option.setName('role').setDescription('Le rôle à retirer').setRequired(true))
        .addStringOption(option =>
          option.setName('target')
            .setDescription('La cible')
            .setRequired(true)
            .addChoices(
              { name: 'Tout le monde', value: 'everyone' },
              { name: 'Humains', value: 'humans' },
              { name: 'Bots', value: 'bots' }
            )))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole('role');
    const target = interaction.options.getString('target');
    const guild = interaction.guild;

    // Permissions check
    if (role.position >= guild.members.me.roles.highest.position) {
      return interaction.reply({
        content: `❌ Je ne peux pas gérer le rôle **${role.name}** car il est supérieur ou égal à mon rôle le plus élevé.`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.reply({ content: '🔄 Récupération des membres en cours...' });

    try {
      // Fetch all members
      const members = await guild.members.fetch();
      let membersToProcess = [];

      // Filter members
      members.forEach(member => {
        let matchesTarget = false;
        if (target === 'everyone') matchesTarget = true;
        else if (target === 'humans') matchesTarget = !member.user.bot;
        else if (target === 'bots') matchesTarget = member.user.bot;

        if (matchesTarget) {
            if (subcommand === 'add' && !member.roles.cache.has(role.id)) {
                membersToProcess.push(member);
            } else if (subcommand === 'remove' && member.roles.cache.has(role.id)) {
                membersToProcess.push(member);
            }
        }
      });

      if (membersToProcess.length === 0) {
        return interaction.editReply({ content: '⚠️ Aucun membre trouvé correspondant aux critères ou n\'ayant pas déjà/encore le rôle.' });
      }

      await interaction.editReply({ content: `🔄 Traitement de ${membersToProcess.length} membres... (Cela peut prendre du temps)` });

      const BATCH_SIZE = 10;
      const DELAY_MS = 2000;
      let processed = 0;
      let errors = 0;

      for (let i = 0; i < membersToProcess.length; i += BATCH_SIZE) {
        const batch = membersToProcess.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        await Promise.all(batch.map(async (member) => {
          try {
            if (subcommand === 'add') await member.roles.add(role);
            else await member.roles.remove(role);
          } catch (e) {
            errors++;
          }
        }));

        processed += batch.length;

        // Update progress every batch
        const percent = Math.floor((processed / membersToProcess.length) * 100);
        await interaction.editReply({
            content: `🔄 Traitement en cours : ${processed}/${membersToProcess.length} (${percent}%)\nErreurs : ${errors}`
        });

        // Anti-RateLimit delay
        if (i + BATCH_SIZE < membersToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      await interaction.editReply({
        content: `✅ Opération terminée !\nAction : ${subcommand === 'add' ? 'Ajout' : 'Retrait'} de **${role.name}**\nTraités : ${processed - errors}\nErreurs : ${errors}`
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: `❌ Une erreur est survenue : ${error.message}` });
    }
  },
};
