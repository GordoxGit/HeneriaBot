# 🟣 Heneria Bot

Bot Discord officiel pour le serveur Heneria, développé avec Discord.js.

## 📋 Informations

- **Version** : 1.0.0
- **Langage** : Node.js (JavaScript)
- **Framework** : Discord.js v14
- **Base de données** : SQLite (via Better-SQLite3)

## 🏗️ Structure du Projet

```
heneria-bot/
├── src/
│   ├── assets/         # Ressources statiques (images, etc.)
│   ├── commands/       # Commandes du bot (organisées par catégorie)
│   │   ├── admin/
│   │   ├── economy/
│   │   ├── fun/
│   │   ├── levels/
│   │   ├── moderation/
│   │   └── tickets/
│   ├── database/       # Fichiers liés à la base de données
│   ├── events/         # Événements Discord
│   ├── handlers/       # Gestionnaires de chargement (commandes, events)
│   ├── utils/          # Utilitaires (Logger, EmbedBuilder, etc.)
│   ├── config.js       # Configuration centralisée
│   └── index.js        # Point d'entrée
├── data/               # Données persistantes (SQLite)
├── logs/               # Fichiers de logs quotidiens
├── .env.example        # Exemple de configuration
├── package.json        # Dépendances et scripts
└── README.md           # Documentation
```

## 🚀 Installation

### Prérequis

- Node.js 20 LTS ou supérieur
- PM2 (pour la production)

### Étapes

1. **Cloner le projet** (ou extraire les fichiers)

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration**
   - Copiez le fichier `.env.example` vers `.env`
   - Remplissez les variables dans `.env` :
     ```ini
     DISCORD_TOKEN=votre_token_ici
     CLIENT_ID=votre_id_client
     GUILD_ID=id_serveur_principal
     ENVIRONMENT=development
     ```

4. **Démarrage**

   - **Développement** (avec rechargement automatique) :
     ```bash
     npm run dev
     ```

   - **Production** :
     ```bash
     npm start
     ```

## 🛠️ Scripts NPM

- `npm start` : Lance le bot normalement via `node`.
- `npm run dev` : Lance le bot avec `nodemon` pour le développement.
- `npm run lint` : Vérifie le code avec ESLint.

## 🎨 Conventions

- **Couleurs** :
  - Violet Principal : `#780CED`
  - Bleu Nuit : `#1D0342`
  - Blanc Rosé : `#F2E1FF`
- **Langue** : Le code et les commentaires sont en **Français**.
- **Style** : Standard JavaScript avec ESLint + Prettier.

## 📝 Auteur

Développé par **Jules** pour **Heneria**.
