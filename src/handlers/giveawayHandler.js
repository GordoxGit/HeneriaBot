const db = require('../database/db');
const logger = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

const CHECK_INTERVAL = 30 * 1000; // 30 seconds

/**
 * Initialise le gestionnaire de giveaways
 * @param {Client} client - Le client Discord
 */
function init(client) {
  // Vérification initiale
  checkGiveaways(client);

  // Lancement de l'intervalle
  setInterval(() => checkGiveaways(client), CHECK_INTERVAL);
  logger.info('Giveaway handler initialized');
}

/**
 * Vérifie les giveaways expirés
 * @param {Client} client
 */
async function checkGiveaways(client) {
  try {
    const expiredGiveaways = db.all('SELECT * FROM giveaways WHERE ended = 0 AND end_timestamp < ?', [Date.now()]);

    for (const giveaway of expiredGiveaways) {
      logger.info(`Giveaway expiré détecté : ${giveaway.message_id}`);
      await endGiveaway(client, giveaway);
    }
  } catch (error) {
    logger.error(`Erreur lors de la vérification des giveaways : ${error.message}`);
  }
}

/**
 * Termine un giveaway
 * @param {Client} client
 * @param {Object} giveaway
 */
async function endGiveaway(client, giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (!channel) {
      logger.warn(`Salon introuvable pour le giveaway ${giveaway.message_id}. Clôture en BDD.`);
      db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [giveaway.id]);
      return;
    }

    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!message) {
      logger.warn(`Message introuvable pour le giveaway ${giveaway.message_id}. Clôture en BDD.`);
      db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [giveaway.id]);
      return;
    }

    const winners = await pickWinners(message, giveaway.winners_count);

    // Mise à jour du message
    const embed = EmbedBuilder.from(message.embeds[0]);
    embed.setTitle('🎉 GIVEAWAY TERMINÉ 🎉');
    embed.setDescription(`**Prix :** ${giveaway.prize}\n**Gagnant(s) :** ${winners.length > 0 ? winners.join(', ') : 'Aucun participant'}\n**Host :** <@${giveaway.host_id}>`);
    embed.setFooter({ text: 'Giveaway terminé' });
    embed.setTimestamp();

    await message.edit({ embeds: [embed] });

    if (winners.length > 0) {
      await channel.send(`Félicitations ${winners.join(', ')} ! Vous avez gagné **${giveaway.prize}** ! 🎉`);
    } else {
      await channel.send(`Giveaway terminé ! Malheureusement, personne n'a participé. 😢`);
    }

    // Marquer comme terminé
    db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [giveaway.id]);
    logger.info(`Giveaway ${giveaway.message_id} terminé avec succès.`);

  } catch (error) {
    logger.error(`Erreur lors de la fin du giveaway ${giveaway.message_id} : ${error.message}`);
  }
}

/**
 * Sélectionne des gagnants pour un message donné
 * @param {Message} message
 * @param {number} count
 * @returns {Promise<string[]>} Liste des mentions des gagnants
 */
async function pickWinners(message, count) {
  try {
    const reaction = message.reactions.cache.get('🎉');
    if (!reaction) return [];

    // Fetch all users who reacted (avec pagination pour dépasser la limite de 100)
    let users = [];
    let lastId;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.after = lastId;

      const fetchedUsers = await reaction.users.fetch(options);
      if (fetchedUsers.size === 0) break;

      fetchedUsers.forEach(user => users.push(user));
      lastId = fetchedUsers.last().id;

      if (fetchedUsers.size < 100) break;
    }

    // Filtrer les bots
    const candidates = users.filter(user => !user.bot);

    if (candidates.length === 0) return [];

    // Sélection aléatoire
    const winners = [];
    // candidates est déjà un tableau ici car on a push dans users[]
    const candidatesArray = candidates;

    for (let i = 0; i < count && candidatesArray.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * candidatesArray.length);
      const winner = candidatesArray.splice(randomIndex, 1)[0];
      winners.push(winner.toString());
    }

    return winners;
  } catch (error) {
    logger.error(`Erreur lors du tirage au sort : ${error.message}`);
    return [];
  }
}

/**
 * Relance le tirage pour un giveaway
 * @param {Client} client
 * @param {string} messageId
 * @returns {Promise<string>} Résultat textuel
 */
async function reroll(client, messageId) {
  const giveaway = db.get('SELECT * FROM giveaways WHERE message_id = ?', [messageId]);

  if (!giveaway) {
    throw new Error('Giveaway introuvable.');
  }

  if (giveaway.ended === 0) {
     throw new Error('Le giveaway n\'est pas encore terminé.');
  }

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel) throw new Error('Salon introuvable.');

  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (!message) throw new Error('Message introuvable.');

  // On tire UN nouveau gagnant pour le reroll
  const winners = await pickWinners(message, 1);

  if (winners.length > 0) {
    await channel.send(`🎉 REROLL ! Le nouveau gagnant est ${winners[0]} ! Félicitations !`);
    return `Nouveau gagnant : ${winners[0]}`;
  } else {
    await channel.send(`Reroll échoué : pas assez de participants.`);
    return 'Aucun participant valide trouvé pour le reroll.';
  }
}

module.exports = {
  init,
  checkGiveaways,
  endGiveaway,
  reroll
};
