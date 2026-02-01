# 📋 Contexte du Projet HeneriaBot

**Date de mise à jour :** 2026-01-27 (Sprint 2.3 Started)
**Sprint Actuel :** 2.3 - Engagement Communautaire
**Priorité :** P1 - FEATURE MAJEURE

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

## 🚀 Prochaines Étapes

1. Exécuter le script de maintenance (voir procédure ci-dessus)
2. Valider le bon fonctionnement de `/vote`
3. Reconfigurer les sites de vote via les commandes administrateur
4. Monitorer les logs pour détecter d'éventuels autres problèmes

---

**Dernière mise à jour :** 2026-01-27 par Claude
**Branch :** `claude/fix-db-schema-column-crk8U`
**Ticket :** P0 - Migration manuelle schéma BDD (missing column)
