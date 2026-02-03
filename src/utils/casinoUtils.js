const db = require('../database/db');

// Map to track active games: userId -> gameType
const activeGames = new Map();

/**
 * Updates or Inserts casino statistics for a user.
 * @param {string} userId
 * @param {string} guildId
 * @param {string} gameType - 'blackjack', 'roulette', 'crash', etc.
 * @param {number} wager - Amount wagered.
 * @param {number} won - Amount won (0 if lost).
 */
function updateCasinoStats(userId, guildId, gameType, wager, won) {
    const sql = `
        INSERT INTO casino_stats (user_id, guild_id, game_type, games_played, total_wagered, total_won)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, guild_id, game_type) DO UPDATE SET
            games_played = games_played + 1,
            total_wagered = total_wagered + excluded.total_wagered,
            total_won = total_won + excluded.total_won
    `;

    try {
        db.run(sql, [userId, guildId, gameType, wager, won]);
    } catch (error) {
        console.error(`Error updating casino stats for ${userId}:`, error);
    }
}

/**
 * Represents a standard 52-card deck.
 */
class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        const suits = ['♠️', '♥️', '♦️', '♣️'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.cards = [];

        for (const suit of suits) {
            for (const value of values) {
                this.cards.push({ suit, value });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

/**
 * Roulette Configuration and Helpers
 */
const ROULETTE = {
    NUMBERS: Array.from({ length: 37 }, (_, i) => i), // 0-36
    COLORS: {
        red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
    },
    // Helper to get color
    getColor: (num) => {
        if (num === 0) return 'green';
        if (ROULETTE.COLORS.red.includes(num)) return 'red';
        return 'black';
    }
};

module.exports = {
    activeGames,
    updateCasinoStats,
    Deck,
    ROULETTE
};
