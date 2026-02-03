# Contexte du Projet

## Objectifs Actuels
1. **Système de Modération Avancé** :
   - Fournir des outils pour gérer le flux de messages (nettoyage de masse, ralentissement) et sécuriser les salons en cas de raid (verrouillage, nuke).
   - Fichiers impactés : `src/commands/moderation/clear.js`, `src/commands/moderation/slowmode.js`, `src/commands/moderation/lock.js`, `src/commands/moderation/unlock.js`, `src/commands/moderation/nuke.js`.

2. **Système de Loterie (Giveaway) et Interactions** :
   - Créer un système de loterie automatique robuste (résistant aux redémarrages).
   - Ajouter des commandes d'interaction directe (Say, DM).
   - Fichiers impactés : `src/database/db.js`, `src/commands/utils/giveaway.js`, `src/commands/utils/say.js`, `src/commands/utils/dm.js`, `src/handlers/giveawayHandler.js`.

## Historique
- Le système de vote et de modération de base (ban, kick, mute) est en place.
- La gestion des tickets et des niveaux est fonctionnelle.

## Spécifications Techniques (Giveaway & Interactions)

### Base de Données
Ajout de la table `giveaways` :
- `id` (INTEGER PRIMARY KEY)
- `message_id` (TEXT, UNIQUE)
- `channel_id` (TEXT)
- `guild_id` (TEXT)
- `prize` (TEXT)
- `winners_count` (INTEGER)
- `end_timestamp` (INTEGER)
- `host_id` (TEXT)
- `ended` (INTEGER DEFAULT 0)

### Commandes
- **/giveaway** :
  - `start` : Durée, gagnants, prix. Embed avec réaction 🎉.
  - `end` : Force l'arrêt par message ID.
  - `reroll` : Tire un nouveau gagnant sur un giveaway terminé.
- **/say** : Répète un message (Permission: Manage Messages). Filtre `@everyone`.
- **/dm** : Envoie un embed MP à un utilisateur (Permission: Administrator).

### Handler
- Scheduler (10-30s) pour vérifier les giveaways expirés (`ended = 0` et `end_timestamp < now`).
- Tirage au sort parmi les réactions 🎉.
- Annonce des gagnants et mise à jour de l'embed.
- Gestion des erreurs et persistance (chargement depuis BDD).

3. **Système Économique (Base & Balance)** :
   - Mise en place de la persistance (Portefeuilles, Inventaires).
   - Commande de consultation de solde.
   - Fichiers impactés : `src/database/db.js`, `src/config/economy.js`, `src/commands/economy/balance.js`.

## Spécifications Techniques (Économie)

### Base de Données
- **wallets** : `user_id`, `guild_id`, `cash`, `bank`, `last_daily`.
- **economy_transactions** : Historique des mouvements.
- **shop_items** : Articles du magasin.
- **inventory** : Inventaires joueurs.

### Commandes
- **/balance** : Affiche le solde (Cash + Banque) et le rang de richesse. Création automatique du compte si inexistant.
