# 📋 Contexte du Projet HeneriaBot

**Date de mise à jour :** 2026-01-27 (Sprint 2.3 Started)
**Sprint Actuel :** 3.1 - Gestion Historique & Logs Centralisés
**Priorité :** P1 - FEATURE MAJEURE

---

## 🚀 Sprint 3.1 : Gestion Historique & Logs Centralisés

**Objectif :** Créer une vision globale du casier judiciaire d'un utilisateur (/history) et assurer que toutes les actions (Kick/Ban/Mute/Warn) soient logguées proprement et notifiées.

### Spécifications Techniques

1.  **Commande `/history`**
    *   **Arguments** : `user` (User).
    *   **Requête SQL** : `SELECT * FROM infractions WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC`.
    *   **Affichage** :
        *   Compteurs par type (ex: "1 Ban, 3 Mutes, 5 Warns").
        *   Liste des 10 dernières infractions (ID, Type, Raison, Date, Modérateur).

2.  **Gestion Centralisée des DM (`src/utils/modUtils.js`)**
    *   **Standardisation** : Tous les DM de sanction (Kick, Ban, Mute, Warn) doivent passer par une fonction unique.
    *   **Format** : Embed Rouge/Orange (selon gravité) avec : Nom Serveur, Type, Raison, Durée (si applicable).
    *   **Gestion d'erreur** :
        *   `try/catch` autour de l'envoi.
        *   Gestion spécifique de l'erreur `50007` (Cannot send messages to this user).
        *   Le bot ne doit pas échouer la sanction si le DM échoue.
        *   Feedback modérateur : "Sanction appliquée (MP impossible : utilisateur fermé)".

3.  **Logs de Modération (`src/utils/modLogger.js`)**
    *   **Découpage** : Séparer l'insertion BDD (`createInfraction`) de l'envoi du log (`logToModChannel`).
    *   **Contenu du Log** : Embed détaillé envoyé dans `mod_log_channel`.
    *   **Champs Requis** :
        *   Modérateur (Avatar + Tag + ID).
        *   Cible (Avatar + Tag + ID).
        *   Détails : Action, Raison, Durée, **ID de l'infraction**.
    *   **Déclenchement** : Le log ne doit être envoyé qu'après confirmation du succès de l'action Discord.

---

## 🚀 Sprint 2.3 : Système de Niveaux, XP et Rank Card

**Objectif :** Implémentation du système de progression (Gamification).

### Spécifications Techniques

1.  **Base de Données (`user_levels`)**
    *   `user_id` (TEXT), `guild_id` (TEXT) - PK
    *   `xp` (INT), `level` (INT)
    *   `total_messages` (INT)
    *   `last_message_timestamp` (INT) - Cooldown management

2.  **Gain d'XP (`messageCreate.js`)**
    *   Ignore bots/system.
    *   Cooldown: 60s.
    *   Gain: 15-25 XP.
    *   Level Up Formula: `XP_Requis = 5 * (niveau ^ 2) + 50 * niveau + 100`

3.  **Commandes (`/rank`)**
    *   Génération d'image via `canvas`.
    *   Affichage : Avatar, Niveau, XP/Next, Rang.

---

## 🔘 Sprint 2.3 (Addendum) : Système d'Autorole

**Objectif :** Création de panneaux interactifs pour l'attribution de rôles.

### Spécifications Techniques

1.  **Base de Données**
    *   `autorole_panels`: Conteneur du panel (Message ID, Channel ID, Titre, Type).
    *   `autorole_entries`: Options du panel (Role ID, Label, Emoji).

2.  **Commandes (`/autorole`)**
    *   `create` : Crée un nouveau panel (Boutons ou Menu Déroulant).
    *   `add` : Ajoute un rôle à un panel existant et met à jour le message.

3.  **Interactions**
    *   Gestion des clics boutons et sélections menus.
    *   Toggle : Ajoute le rôle s'il est absent, le retire s'il est présent.
    *   Sécurité : Vérification des permissions du bot.

---

## 🤖 État du Bot

- **Statut :** ✅ En ligne (démarrage réussi)
- **Environnement :** Production
- **Version Discord.js :** Compatible avec les dernières fonctionnalités
- **Base de données :** SQLite (better-sqlite3)
- **Chemin DB :** `./data/heneria.db`

---

## ⚠️ Incidents Actifs (En cours de résolution)

### Incident 1 : Récompenses de Niveaux (Critique)
- **Problème :** Le passage de niveau est détecté (l'XP monte), mais le rôle configuré dans `level_rewards` n'est pas attribué à l'utilisateur.
- **Diagnostic :** La logique de récupération et d'attribution du rôle dans `messageCreate.js` est potentiellement défaillante ou manque de robustesse (cache, permissions).
- **Correctif prévu :** Injection/Renforcement de la logique SELECT et attribution via API avec gestion d'erreurs explicite.

### Incident 2 : Warning Autorole (Mineur)
- **Problème :** Avertissement "Supplying 'ephemeral' is deprecated" lors de l'utilisation de `/autorole`.
- **Diagnostic :** Utilisation de l'ancienne syntaxe `ephemeral: true`.
- **Correctif prévu :** Passage à `flags: MessageFlags.Ephemeral` (Discord.js v14+).

---

## ⚠️ Incident Critique - Système de Vote (Historique)

### Description de l'Incident

**Type :** Exception système lors de l'exécution de la commande `/vote`
**Erreur identifiée :** `SqliteError: no such column: slug`
**Fichier concerné :** `src/commands/info/vote.js`
**Impact :** Crash de toutes les interactions utilisateur lors de l'utilisation de `/vote`

### Analyse Technique

#### Cause Racine

Le schéma de la base de données n'est pas synchronisé avec le code source actuel :

- **Code actuel** (`src/database/db.js:142`) : Définit la table `vote_sites` avec la colonne `slug`
- **Base de données existante** : Contient une ancienne version de la table sans la colonne `slug`
- **Conséquence** : Le code tente d'accéder à `site.slug` (lignes 46, 57, 59, 63 de `vote.js`), provoquant une erreur SQLite

#### Explication Technique

**Pourquoi CREATE TABLE IF NOT EXISTS ne résout pas le problème :**

L'instruction SQL `CREATE TABLE IF NOT EXISTS` utilisée dans `src/database/db.js:138-155` :
- Crée la table uniquement si elle n'existe pas
- **Ne modifie JAMAIS** une table existante
- **N'ajoute pas** les colonnes manquantes aux tables anciennes

**État du système de migration :**

La fonction `migrateTables()` dans `src/database/db.js:276-278` est actuellement vide :
```javascript
function migrateTables() {
  // Pas de migrations pour le moment
}
```

Cette absence de logique de migration automatique explique pourquoi :
- Les tables créées avec une ancienne version du code restent figées
- L'ajout de nouvelles colonnes dans le code ne se propage pas à la base existante
- Une intervention manuelle est nécessaire pour synchroniser le schéma

#### Tables Affectées

Les tables suivantes du module de vote nécessitent une réinitialisation :

1. `vote_sites` - Configuration des sites de vote (problème principal)
2. `user_votes` - Historique des votes utilisateurs
3. `vote_otp_sessions` - Sessions OTP pour serveur-prive.net
4. `vote_stats` - Statistiques et streaks des utilisateurs
5. `vote_rewards_config` - Configuration des récompenses

---

## 🔧 Solution Mise en Œuvre

### Script de Maintenance Créé

**Fichier :** `maintenance/reset_vote_tables.js`

**Fonctionnalités :**
- Suppression sécurisée des 5 tables de vote dans l'ordre correct (respect des clés étrangères)
- Suppression des index associés
- Gestion d'erreurs complète
- Messages de confirmation détaillés

### Procédure d'Exécution

```bash
# 1. Arrêter le bot Discord
pm2 stop heneria-bot
# ou ctrl+C si lancé manuellement

# 2. Exécuter le script de maintenance
node maintenance/reset_vote_tables.js

# 3. Redémarrer le bot
npm start
# ou pm2 start heneria-bot
```

### Résultat Attendu

Au redémarrage du bot, le fichier `src/database/db.js` :
- Détecte l'absence des tables de vote
- Recrée automatiquement toutes les tables avec la structure correcte
- Inclut la colonne `slug` dans `vote_sites`
- Recrée tous les index nécessaires

---

## ✅ Protocole de Validation

### Vérifications Post-Déploiement

1. **Logs de Démarrage**
   - Vérifier l'absence de `SqliteError` dans les logs
   - Confirmer la création des tables : `Table 'vote_sites' vérifiée/créée`

2. **Test Fonctionnel**
   - Exécuter `/vote` sur Discord
   - **Résultat attendu :** Affichage de l'embed avec les sites de vote disponibles
   - **Échec si :** Message d'erreur système ou crash de l'interaction

3. **Vérification Structure DB**
   ```bash
   sqlite3 data/heneria.db "PRAGMA table_info(vote_sites);"
   ```
   Doit afficher la colonne `slug` de type TEXT (ligne 2 du résultat)

---

## 📁 Structure du Système de Vote

### Fichiers Principaux

```
src/
├── commands/info/vote.js          # Commande /vote (utilise site.slug)
├── database/db.js                 # Schéma DB (définit la colonne slug)
├── handlers/voteHandler.js        # Logique de gestion des votes
└── config.js                      # Configuration (chemin DB)

maintenance/
└── reset_vote_tables.js           # Script de réinitialisation
```

### Dépendances Clés

- `better-sqlite3` : Gestion de la base SQLite
- `discord.js` : Framework Discord Bot
- Webhooks API : serveur-prive.net, hytale-servs.fr

---

## 🔒 Points de Sécurité

- ✅ Script de maintenance avec gestion d'erreurs
- ✅ Sauvegarde automatique possible via `.backup()` de better-sqlite3
- ✅ Pas de perte de données critiques (les votes seront réinitialisés)
- ⚠️ **Important :** Toujours arrêter le bot avant d'exécuter le script

---

## 📊 Historique des Modifications

### 2026-01-27 - Mise à jour Documentation Technique

- **Contexte :** Ticket P0 - Migration manuelle schéma BDD (missing column)
- **Ajouts :**
  - Explication détaillée de la limitation `CREATE TABLE IF NOT EXISTS`
  - Documentation de l'état vide de la fonction `migrateTables()`
  - Clarification de la nécessité d'intervention manuelle
- **Fichiers modifiés :**
  - `pwd.md` (ajout section "Explication Technique")
- **Statut :** Documentation complétée

### 2026-01-27 - Résolution Incident Vote

- **Problème :** `SqliteError: no such column: slug`
- **Solution :** Script de réinitialisation des tables de vote
- **Fichiers créés :**
  - `maintenance/reset_vote_tables.js`
  - `pwd.md` (ce fichier)
- **Statut :** Résolu, en attente de validation

### 2026-01-27 - Sprint 2.3 Continued

**Nouvelles Fonctionnalités :**
- Outils de gestion d'expérience (Admin)
- Classement global (/leaderboard)
- Récompenses de rôles par niveau

**Fichiers impactés :**
- `src/commands/levels/leaderboard.js` (Nouveau)
- `src/commands/admin/managexp.js` (Nouveau)
- `src/commands/admin/levelreward.js` (Nouveau)
- `src/events/messageCreate.js` (Modifié)
- `src/database/db.js` (Modifié - Nouvelle table `level_rewards`)

**Notes Techniques :**
- Ajout de la table `level_rewards` avec contrainte unique `(guild_id, level)`.
- `/leaderboard` avec pagination via `ComponentCollector`.
- `/managexp` doit recalculer les niveaux pour maintenir la cohérence XP/Level.
- `/levelreward` permet la configuration des rôles attribués au Level Up.

---

**Dernière mise à jour :** 2026-01-27 par Claude
**Branch :** `claude/fix-db-schema-column-crk8U`
**Ticket :** P0 - Migration manuelle schéma BDD (missing column)

## 🛡️ Sprint 2.3 (Addendum) : Modération Punitive

**Objectif :** Implémentation des outils de modération punitive et de la traçabilité des sanctions.

### Spécifications Techniques

1.  **Base de Données (Schema)**
    *   Table `infractions` : Trace toutes les sanctions (Kick, Ban, Tempban, Unban).
    *   Champs : `id`, `guild_id`, `user_id`, `moderator_id`, `type`, `reason`, `created_at`, `expires_at`, `active`.

2.  **Logique de Modération & Logs**
    *   **Envoi DM** : Notification à l'utilisateur sanctionné.
    *   **Logs Serveur** : Embed dans le salon défini (`mod_log_channel`).
    *   **Persistance** : Enregistrement dans la DB.

3.  **Commandes de Sanction**
    *   `/kick` : Expulsion + Log.
    *   `/ban` : Bannissement (définitif ou temporaire) + Log.
    *   `/unban` : Révoquer bannissement + Log + Update historique.

4.  **Validation Technique**
    *   Hiérarchie des rôles.
    *   Gestion des bans temporaires (révocation automatique).

## 🛡️ Sprint 2.3 (Addendum 2) : Gestion des Mutes et Avertissements

**Objectif :** Implémentation des sanctions temporaires (Timeout) et du système d'avertissements cumulatifs.

### Spécifications Techniques

1.  **Base de Données**
    *   Utilisation de la table `infractions`.
    *   Types : `MUTE` (pour Timeout), `WARN` (pour Avertissement).

2.  **Gestion des Mutes (Timeout)**
    *   `/mute` : Application timeout Discord + Log DB + DM.
    *   `/unmute` : Retrait timeout + Update DB (active=0) + Log.
    *   Expiration : Retrait automatique via Discord, nettoyage DB nécessaire.

3.  **Système d'Avertissements (Warns)**
    *   `/warn` : Log DB (active=1) + DM.
    *   `/warnings` : Liste les avertissements actifs.
    *   `/clearwarns` : Désactive tous les avertissements (active=0).

4.  **Fichiers Impactés**
    *   `src/commands/moderation/mute.js`
    *   `src/commands/moderation/unmute.js`
    *   `src/commands/moderation/warn.js`
    *   `src/commands/moderation/warnings.js`
    *   `src/commands/moderation/clearwarns.js`

## 🛡️ Sprint 3.X (Addendum) : Gestion Utilisateurs & Automatisations

**Objectif :** Gestion fine des utilisateurs (pseudos, rôles) et automatisation des fins de sanctions (tempban) ainsi que l'escalade des sanctions (auto-mute après X warns).

### Spécifications Techniques

1. **Gestion des Utilisateurs**
   *   **`/nick`** : Modification de pseudo avec vérification de hiérarchie et longueur.
   *   **`/role`** : Ajout/Retrait de rôle avec vérification de hiérarchie (Bot > Rôle).
   *   **`/massrole`** : Actions de masse (Add/Remove) sur Everyone/Humans/Bots avec Batch Processing (anti-RateLimit).

2. **Scheduler (Tempban & Mutes)**
   *   Boucle de vérification (60s).
   *   **Tempban** : Unban automatique + Log ("Unban automatique de X").
   *   **Mute** : Update BDD (`active = 0`) à l'expiration.

3. **Auto-Actions sur Warnings**
   *   **Table `warn_config`** : `guild_id`, `threshold`, `action`, `duration`.
   *   **Trigger** : À chaque `/warn`, vérification du seuil.
   *   **Actions** : MUTE, KICK, BAN automatique si seuil atteint.

## 🛡️ Sprint 3.X (Addendum) : Finalisation des Outils de Modération

**Objectif :** Configuration des logs, correction visuelle Nuke, et notifications de levée de sanction.

### Spécifications Techniques

1. **Configuration des Logs (`/setlogs`)**
   - **Commande :** `src/commands/admin/setlogs.js`
   - **Action :** Configure `mod_log_channel` dans la table `settings`.
   - **Impact :** Toutes les actions de modération lisent cette configuration pour envoyer les logs.

2. **Fix Affichage `/nuke`**
   - **Problème :** Affichage brut de l'URL du GIF.
   - **Solution :** Utilisation d'un `EmbedBuilder` avec `.setImage()`.
   - **Fichier :** `src/commands/moderation/nuke.js`.

3. **Notifications de Levée de Sanction (DM)**
   - **Actions Manuelles :** `unban`, `unmute`, `clearwarns` envoient un MP à l'utilisateur ("Sanction levée / Pardonnée").
   - **Actions Automatiques :** Le scheduler (`moderationHandler.js`) envoie un MP lors de l'expiration d'un Tempban ou d'un Mute.
   - **Gestion d'Erreur :** `try/catch` silencieux sur l'envoi de MP (si DM fermés).

## 🛠️ Sprint 3.X (Addendum) : Outils Utilitaires

**Objectif :** Fournir au staff des outils pour créer des messages visuels (Embeds), faire des annonces officielles et lancer des sondages structurés.

### Spécifications Techniques

1. **Système d'Annonces (`/announce`)**
   - **Arguments :** Salon, Titre, Message, Image (opt), Mention (Everyone/Here/None).
   - **Comportement :** Envoie un Embed (couleur principale) dans le salon cible. Gère la mention hors de l'embed pour la notification.

2. **Builder d'Embeds (`/embed`)**
   - **Sous-commande `create` :** Assistant interactif via Modale -> Prévisualisation -> Boutons (Envoyer, Modifier, Annuler).
   - **Sous-commande `edit` :** Modification directe d'un message existant via Modale pré-remplie.
   - **Technique :** Gestion des interactions Modales et Boutons centralisée dans `embedInteractionManager.js`.

3. **Système de Sondages (`/poll`)**
   - **Arguments :** Question, Options (séparées par `|`).
   - **Comportement :** Embed avec liste numérotée (1-10). Ajout automatique et séquentiel des réactions.
   - **Limites :** Max 10 options.

---

## 🔐 Sprint 4.0 : Système de Permissions Dynamique et Présentation Staff

**Objectif :** Remplacer les permissions Discord natives par un système BDD flexible et automatiser la présentation du staff.

### Spécifications Techniques

1. **Base de Données (Schema)**
   *   **`command_permissions`** : `id`, `guild_id`, `command_name`, `role_id`.
   *   **`team_members`** : `id`, `guild_id`, `user_id`, `role_label`, `order_position`, `social_link`.

2. **Middleware de Permissions (`interactionCreate`)**
   *   **Priorité** : Admin (Natif) > Owner > BDD (`command_permissions`) > Défaut (Code).
   *   **Comportement** : Si une règle existe en BDD pour la commande, l'utilisateur DOIT avoir le rôle. Sinon, fallback sur permission native.
   *   **Refus** : Message éphémère "⛔ Vous n'avez pas la permission requise (Système Heneria)."

3. **Commande `/perms` (Admin)**
   *   `add [cmd] [role]` : Autorise un rôle.
   *   `remove [cmd] [role]` : Retire l'accès.
   *   `list` : Affiche les configurations.
   *   `reset` : Remise à zéro.

4. **Commande `/team` (Admin)**
   *   `add/remove/update` : Gestion des membres (`team_members`).
   *   `setup` : Crée le message/embed "Notre Équipe".
   *   `refresh` : Met à jour l'embed existant (sauvegardé dans `settings`).
   *   **Affichage** : Tri par `order_position`, Embed propre avec Avatar/Pseudo/Rôle.

**Fichiers impactés :** `src/database/db.js`, `src/events/interactionCreate.js`, `src/commands/admin/perms.js`, `src/commands/utils/team.js`.

## 💰 Sprint 3.X (Addendum) : Économie Globale

**Objectif :** Permettre la circulation de la monnaie (paiements entre joueurs), l'injection de liquidités (daily) et la régulation par les administrateurs.

### Spécifications Techniques

1. **Récompense Journalière (`/daily`)**
   - **Logique :** Cooldown de 20h (Config). Gain de 500 crédits.
   - **Trace :** Enregistrement dans `economy_transactions` (Type: 'REWARD').

2. **Virements (`/pay`)**
   - **Sécurité :** Vérification solde (Cash uniquement), montant positif, anti-auto-paiement.
   - **Trace :** Enregistrement dans `economy_transactions` (Type: 'PAY').

3. **Classement (`/baltop`)**
   - **Affichage :** Top 10 (Cash + Bank).
   - **Position Joueur :** Affichée en footer si hors Top 10.

4. **Administration (`/eco`)**
   - **Sous-commandes :** `give`, `take`, `set`, `reset`, `reset_all`.
   - **Sécurité :** Logs systématiques dans le salon de modération.
   - **Reset Global :** Sécurisé par bouton de confirmation.

**Fichiers impactés :** `src/commands/economy/daily.js`, `src/commands/economy/pay.js`, `src/commands/economy/baltop.js`, `src/commands/admin/eco.js`, `src/config/economy.js`.

## 🏦 Sprint 3.X (Addendum) : Banque et Transactions

**Objectif :** Permettre aux joueurs de sécuriser leur argent en le déplaçant de leur portefeuille (Cash) vers leur compte en banque (Bank), et inversement.

### Spécifications Techniques

1. **Commande de Dépôt (`/deposit`)**
   - **Arguments :** montant (String). Accepte un nombre entier OU le mot-clé "all" (ou "tout").
   - **Logique Métier :**
     - Récupérer le solde cash actuel.
     - **Validation :**
       - Si argument = "all"/"tout", le montant devient égal au solde cash.
       - Vérifier que le montant > 0.
       - Vérifier que l'utilisateur a assez de cash disponible.
     - **Transaction :**
       - `cash = cash - montant`
       - `bank = bank + montant`
       - Trace : Enregistrement dans `economy_transactions` (Type: 'DEPOSIT').
     - **Réponse :** Embed confirmant le dépôt ("💳 Vous avez déposé X à la banque").

2. **Commande de Retrait (`/withdraw`)**
   - **Arguments :** montant (String). Accepte un nombre entier OU "all"/"tout".
   - **Logique Métier :**
     - Récupérer le solde bank actuel.
     - **Validation :**
       - Si argument = "all"/"tout", le montant devient égal au solde bank.
       - Vérifier que le montant > 0.
       - Vérifier que l'utilisateur a assez d'argent en bank.
     - **Transaction :**
       - `bank = bank - montant`
       - `cash = cash + montant`
       - Trace : Enregistrement dans `economy_transactions` (Type: 'WITHDRAW').
     - **Réponse :** Embed confirmant le retrait ("💸 Vous avez retiré X de la banque").

3. **Validation Technique**
   - **Keyword "all" :** Le parsing de l'argument doit gérer insensiblement la casse (all, ALL, Tout).
   - **Intégrité :** Impossible de déposer de l'argent qu'on n'a pas (pas de solde négatif).
   - **Affichage :** La commande `/balance` (déjà existante) devra bien refléter ces changements (Cash baisse, Banque monte).

**Fichiers impactés :** `src/commands/economy/deposit.js`, `src/commands/economy/withdraw.js`.

## 🛠️ Sprint 3.X (Addendum) : Diversification Économie (Jobs & Craft)

**Objectif :** Diversifier l'économie avec des boucles de gameplay PvE, Exploration et Crafting.

### Spécifications Techniques

1.  **Base de Données**
    *   **Table `recipes`** : `id`, `result_item_id`, `materials` (JSON), `required_job_level`.
    *   Dépendance : Les items (matériaux et résultats) doivent exister dans `shop_items`.

2.  **Nouveaux Métiers**
    *   **Guerrier (Warrior)** : PvE, Risque/Récompense. Loot : Cuir, Os, Viande, Pièces d'or.
    *   **Explorateur (Explorer)** : RNG élevé. Loot : Cartes, Reliques, Coffres, Artefacts.
    *   **Artisan** : Transformation de ressources via `/craft`.

3.  **Système de Craft (`/craft`)**
    *   **List** : Affiche les recettes.
    *   **Make** : Fabrique un objet (Atomicité : Retrait matériaux -> Ajout item -> XP).
    *   **Logique** : Vérifie niveau métier et inventaire.

**Fichiers impactés :** `src/jobs/warrior.js`, `src/jobs/explorer.js`, `src/jobs/artisan.js`, `src/commands/economy/craft.js`, `src/database/db.js`.

## 🎲 Sprint 3.X (Addendum) : Casino & Jeux de Hasard

**Objectif :** Implémenter des jeux de hasard pour divertir la communauté et créer des puits de consommation (Money Sinks) pour réguler l'inflation de l'économie. Intégration visuelle du lore Hytale.

### Spécifications Techniques

1.  **Logique Commune (Sécurité)**
    *   **Validation :** Solde >= mise > 0.
    *   **Atomicité :** Débit immédiat AVANT le RNG. Crédit UNIQUEMENT si victoire.
    *   **Logs :** Trace systématique dans `economy_transactions` (Type: 'CASINO_BET', 'CASINO_WIN').
    *   **Limites :** Plafond de mise (`MAX_BET`) configurable.

2.  **Commandes de Jeu**
    *   **`/coinflip`** : Pile ou Face (x2). Animation "La pièce tourne...".
    *   **`/dice`** : Duel de Dés (Joueur vs Bot). Si Joueur > Bot (x2). Si Égalité (Remboursé).
    *   **`/slots`** : Machine à sous avec symboles Hytale pondérés (Commun à Légendaire).
        *   **Gains :** x3 (Commun), x10 (Rare), x50 (Légendaire), x1.5 (Paire).
        *   **Visuel :** Animation de défilement via édition de message.

**Fichiers impactés :** `src/commands/economy/coinflip.js`, `src/commands/economy/dice.js`, `src/commands/economy/slots.js`, `src/utils/emojis.js`, `src/config/economy.js`.
