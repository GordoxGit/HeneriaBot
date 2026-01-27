/**
 * Script de maintenance : Réinitialisation des tables de vote
 *
 * Ce script supprime toutes les tables liées au système de vote pour permettre
 * leur recréation avec la structure mise à jour lors du prochain démarrage du bot.
 *
 * ATTENTION : Ce script supprimera toutes les données de vote existantes.
 *
 * Usage :
 *   1. Arrêter le bot Discord
 *   2. Exécuter : node maintenance/reset_vote_tables.js
 *   3. Redémarrer le bot
 */

const Database = require('better-sqlite3');
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, '..', 'data', 'heneria.db');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   Script de réinitialisation des tables de vote           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

try {
  console.log(`📁 Connexion à la base de données : ${dbPath}`);
  const db = new Database(dbPath);

  console.log('✓ Connexion établie\n');

  // Liste des tables à supprimer (dans l'ordre pour respecter les clés étrangères)
  const voteTables = [
    'vote_otp_sessions',
    'user_votes',
    'vote_stats',
    'vote_rewards_config',
    'vote_sites'
  ];

  console.log('🗑️  Suppression des tables de vote :\n');

  for (const table of voteTables) {
    try {
      // Vérifier si la table existe
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `).get(table);

      if (tableExists) {
        db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
        console.log(`   ✓ Table '${table}' supprimée`);
      } else {
        console.log(`   ⊘ Table '${table}' n'existe pas (ignorée)`);
      }
    } catch (error) {
      console.error(`   ✗ Erreur lors de la suppression de '${table}' : ${error.message}`);
    }
  }

  // Supprimer également les index liés
  console.log('\n🗑️  Suppression des index associés :\n');

  const voteIndexes = [
    'idx_user_votes_user',
    'idx_user_votes_site',
    'idx_user_votes_time',
    'idx_otp_user',
    'idx_otp_expires'
  ];

  for (const index of voteIndexes) {
    try {
      db.prepare(`DROP INDEX IF EXISTS ${index}`).run();
      console.log(`   ✓ Index '${index}' supprimé`);
    } catch (error) {
      console.error(`   ✗ Erreur lors de la suppression de l'index '${index}' : ${error.message}`);
    }
  }

  db.close();
  console.log('\n✓ Connexion fermée');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                 ✓ Opération terminée !                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('📋 Prochaines étapes :');
  console.log('   1. Démarrer le bot avec : npm start');
  console.log('   2. Les tables seront recréées automatiquement avec la');
  console.log('      nouvelle structure (incluant la colonne "slug")');
  console.log('   3. Tester la commande /vote pour confirmer le bon');
  console.log('      fonctionnement\n');

} catch (error) {
  console.error('\n✗ ERREUR CRITIQUE :', error.message);
  console.error('\n📋 Vérifications :');
  console.error('   • Le bot est-il bien arrêté ?');
  console.error('   • Le fichier de base de données existe-t-il ?');
  console.error('   • Avez-vous les permissions nécessaires ?\n');
  process.exit(1);
}
