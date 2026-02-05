# Contexte du Projet

## Objectifs Actuels
1. **Système de Modération Avancé** :
   - Fournir des outils pour gérer le flux de messages (nettoyage de masse, ralentissement) et sécuriser les salons en cas de raid (verrouillage, nuke).
   - Fichiers impactés : `src/commands/moderation/clear.js`, `src/commands/moderation/slowmode.js`, `src/commands/moderation/lock.js`, `src/commands/moderation/unlock.js`, `src/commands/moderation/nuke.js`.

2. **Système de Loterie (Giveaway) et Interactions** :
   - Créer un système de loterie automatique robuste (résistant aux redémarrages).
   - Ajouter des commandes d'interaction directe (Say, DM).
   - Fichiers impactés : `src/database/db.js`, `src/commands/utils/giveaway.js`, `src/commands/utils/say.js`, `src/commands/utils/dm.js`, `src/handlers/giveawayHandler.js`.

3. **Magasin Virtuel (Shop)** :
   - Création d'un magasin permettant l'achat d'objets et de rôles avec la monnaie virtuelle.
   - Gestion administrative du catalogue (ajout/suppression).
   - Système de transaction atomique avec gestion de stock.
   - Fichiers impactés : `src/commands/economy/shop.js`, `src/commands/economy/buy.js`, `src/commands/economy/inventory.js`.

4. **Système de RPG Économique (Métiers)** :
   - Implémenter un système de progression professionnelle où les joueurs choisissent un métier.
   - Focus initial sur le métier "Mineur" avec récolte de ressources (items) et gain d'XP.
   - Fichiers impactés : `src/database/db.js`, `src/commands/economy/work.js`, `src/jobs/miner.js`.

5. **Métier Chasseur & Événements Critiques** (NOUVEAU) :
   - Implémenter le métier "Chasseur" avec mécaniques de traque et combat.
   - Ajouter un système de déblocage de métiers (Progression).
   - Intégrer des événements rares (Jackpots/Boss) et des cooldowns dynamiques.
   - Fichiers impactés : `src/jobs/hunter.js`, `src/commands/economy/work.js`, `src/database/db.js`.

6. **Jeux de Casino Interactifs** (NOUVEAU) :
   - Implémenter Blackjack, Roulette, et Crash.
   - Système de statistiques de jeu (`casino_stats`).
   - Gestion de la concurrence et des transactions atomiques.
   - Fichiers impactés : `src/commands/economy/blackjack.js`, `src/commands/economy/roulette.js`, `src/commands/economy/crash.js`, `src/database/db.js`, `src/utils/casinoUtils.js`.

7. **Quiz Interactif Hytale** (NOUVEAU) :
   - Engager la communauté autour du Lore de Hytale via un système de Quiz interactif.
   - Base de connaissances de 50+ questions sur l'univers Hytale.
   - Système de récompenses et leaderboard.
   - Fichiers impactés : `src/database/db.js`, `src/commands/fun/quiz.js`, `src/commands/admin/quizadd.js`, `src/data/quizQuestions.json`.

8. **Moteur d'Échecs** (NOUVEAU) :
   - Implémentation complète du jeu d'échecs (1v1) avec validation des coups.
   - Rendu visuel du plateau via API externe.
   - Système d'invitation et persistance en mémoire de l'état du jeu.
   - Fichiers impactés : `src/commands/fun/chess.js`, `src/utils/chessRenderer.js`.

9. **Culture Générale** (NOUVEAU) :
   - Système de questions/réponses de culture générale (distinct du quiz Hytale).
   - Source de données locale (JSON) pour garantir la qualité et la langue (FR).
   - Fichiers impactés : `src/commands/fun/trivia.js`, `src/data/triviaQuestions.json`.

## Historique
- Le système de vote et de modération de base (ban, kick, mute) est en place.
- La gestion des tickets et des niveaux est fonctionnelle.
- Système économique de base (Balance, Daily, Pay) en place.
- Métier Mineur implémenté.

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

## Spécifications Techniques (Économie)

### Base de Données
- **wallets** : `user_id`, `guild_id`, `cash`, `bank`, `last_daily`.
- **economy_transactions** : Historique des mouvements.
- **shop_items** : Articles du magasin (`id`, `name`, `price`, `description`, `role_id`, `stock`).
- **inventory** : Inventaires joueurs (`user_id`, `item_id`, `quantity`).

### Commandes
- **/balance** : Affiche le solde (Cash + Banque) et le rang de richesse.
- **/shop** :
  - `view` : Liste les articles avec pagination.
  - `admin add/remove` : Gestion du catalogue.
- **/buy** : Achat d'objets (Transaction atomique, attribution de rôle).
- **/inventory** : Visualisation des objets possédés.

## Spécifications Techniques (RPG Métiers)

### Base de Données
Modification de la table `job_progress` :
- `user_id` (TEXT)
- `guild_id` (TEXT)
- `job_slug` (TEXT)
- `level` (INTEGER)
- `experience` (INTEGER)
- `last_worked` (INTEGER)
- `unlocked` (INTEGER DEFAULT 0) [NOUVEAU]

### Architecture
- **Structure modulaire** : Les métiers sont définis dans `src/jobs/` (ex: `miner.js`, `hunter.js`).
- **/work** : Commande principale faisant office de routeur.
  - `choose` : Sélection du métier avec vérification des pré-requis (ex: Warrior Lv 5 pour Hunter).
  - `perform` : Exécution de la tâche.
    - Cooldown dynamique selon le métier (Mineur 30m, Chasseur 4h).
    - Événements Critiques (1/1000) : Jackpot (x10) ou Boss.
  - `info` : Affichage de la progression.
- **Logique Chasseur** :
  - Phase 1 : Traque (RNG). Échec = Cooldown réduit.
  - Phase 2 : Combat (Niveau + Bonus Arme).
  - Loot : Trophées, Peaux, Essences.

## 6. Administration Avancée & Améliorations UX
- **Administration des Recettes (/craft admin)** :
  - Permettre aux administrateurs de créer et supprimer des recettes d'artisanat via commande.
  - Fichiers impactés : `src/commands/economy/craft.js`.
- **UX Améliorée (Barre d'XP)** :
  - Remplacer l'affichage textuel de l'XP par une barre visuelle.
  - Fichiers impactés : `src/commands/economy/work.js`, `src/utils/ui.js`.
- **Administration XP Métiers (/job admin)** :
  - Gérer l'XP et les niveaux des joueurs manuellement (Ajout, Retrait, Reset).
  - Fichiers impactés : `src/commands/economy/job.js`.

## Spécifications Techniques (Casino)

### Base de Données
Ajout de la table `casino_stats` :
- `user_id` (TEXT)
- `guild_id` (TEXT)
- `game_type` (TEXT)
- `games_played` (INTEGER)
- `total_wagered` (INTEGER)
- `total_won` (INTEGER)
- PK: `(user_id, guild_id, game_type)`

### Commandes
- **/blackjack** : Jeu de cartes contre le croupier (Hit/Stand).
- **/roulette** : Mises sur couleurs ou nombres.
- **/crash** : Multiplicateur en temps réel avec cash-out.
- **/casino stats** : Statistiques globales du joueur.

## Spécifications Techniques (Quiz)

### Base de Données
Ajout de la table `quiz_questions` :
- `id` (INTEGER PRIMARY KEY)
- `question` (TEXT)
- `answers` (TEXT) - JSON Array
- `correct_index` (INTEGER)
- `difficulty` (TEXT)
- `category` (TEXT)

Ajout de la table `quiz_scores` :
- `user_id` (TEXT)
- `guild_id` (TEXT)
- `correct_answers` (INTEGER)
- `total_earnings` (INTEGER)
- PK: `(user_id, guild_id)`

### Commandes
- **/quiz** : Lance une question aléatoire (Boutons). Gain de monnaie.
- **/quizadd** : Ajout de question par les admins.

## Spécifications Techniques (Échecs)

### Architecture
- **Moteur** : Utilisation de la librairie `chess.js` pour la logique de jeu (validation, échec, mat).
- **Rendu** : Génération d'image via API (ex: chess.com/dynboard).
- **État** : Stockage en mémoire (`Map`) des parties en cours.
- **Interaction** :
  - Invitation via `initiateChallenge`.
  - Coups joués via Modale (Notation Algébrique).
  - Boutons pour Abandon/Nulle.

## Spécifications Techniques (Trivia)

### Données
- **Source** : `src/data/triviaQuestions.json` contenant 50+ questions FR.
- **Structure** : `{ question, answers, correct_index, difficulty, category }`.

### Commande (/trivia)
- Sélection aléatoire d'une question.
- Affichage via Embed + Boutons.
- Récompense monétaire selon la difficulté.
