const express = require('express');
// Removed supertest require

const db = require('../src/database/db');
const voteHandler = require('../src/handlers/voteHandler');
const voteRouter = require('../src/api/voteWebhook');
const config = require('../src/config');
const fs = require('fs');
const path = require('path');

// Mock Config
config.paths.database = './tests/output/test_heneria.db';
config.guildId = 'test-guild-id';
process.env.VOTE_TOKEN_HYTALEGAME = 'test-token';

// Ensure test directory exists
if (!fs.existsSync('./tests/output')) {
    fs.mkdirSync('./tests/output', { recursive: true });
}

// Remove old DB
if (fs.existsSync(config.paths.database)) {
    fs.unlinkSync(config.paths.database);
}

// Init DB
db.init();

// Mock Client
const mockChannel = {
    send: async (msg) => {
        console.log('Mock Channel Send:', JSON.stringify(msg, null, 2));
        return true;
    }
};

const mockGuild = {
    channels: {
        cache: {
            get: (id) => mockChannel
        }
    }
};

const mockClient = {
    guilds: {
        cache: {
            get: (id) => mockGuild
        }
    }
};

// Init Handler
voteHandler.init(mockClient);

// Setup Express
const app = express();
app.use(express.json());
app.use('/api', voteRouter);

const PORT = 3333;
const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);

    try {
        await runTests();
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        server.close();
        db.close();
    }
});

async function runTests() {
    const baseUrl = `http://localhost:${PORT}/api`;

    // Setup initial data
    // 1. Create guild settings for vote channel
    db.run("INSERT INTO settings (guild_id, key, value) VALUES (?, 'vote_channel_id', ?)", ['test-guild-id', 'test-channel-id']);
    // 2. Add vote site if not exists (initVoteSites should have done it, but let's verify)
    const sites = db.all("SELECT * FROM vote_sites");
    console.log('Sites:', sites.length);

    // Test 1: Webhook without auth
    console.log('\n--- Test 1: No Auth ---');
    const res1 = await fetch(`${baseUrl}/vote?site=hytale.game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_id: '123', username: 'test', timestamp: Date.now() })
    });
    console.log('Status:', res1.status); // Expected 401

    // Test 2: Webhook with valid auth and data
    console.log('\n--- Test 2: Valid Auth ---');
    const res2 = await fetch(`${baseUrl}/vote?site=hytale.game`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ discord_id: 'user-123', username: 'TestUser', timestamp: Date.now() })
    });
    console.log('Status:', res2.status); // Expected 200
    const body2 = await res2.json();
    console.log('Body:', body2);

    // Verify DB
    const vote = db.get("SELECT * FROM user_votes WHERE user_id = ?", ['user-123']);
    console.log('Vote in DB:', vote ? 'Found' : 'Not Found');
    if (vote) console.log('Verified:', vote.verified);

    // Test 3: Cooldown
    console.log('\n--- Test 3: Cooldown ---');
    const res3 = await fetch(`${baseUrl}/vote?site=hytale.game`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ discord_id: 'user-123', username: 'TestUser', timestamp: Date.now() })
    });
    // Currently, the handler returns true (success) even if on cooldown?
    // Wait, let's check voteHandler.js code.
    // if (await this.isOnCooldown(...)) { logger.info... return false; }
    // processVote returns false.
    // In webhook: await voteHandler.processVote(...)
    // It doesn't check return value. It just sends 200 OK.
    // This is often desired for webhooks (acknowledge receipt even if duplicate/ignored logic-wise).
    // But let's check logs (simulated).
    console.log('Status:', res3.status); // Expected 200

    const votesCount = db.get("SELECT count(*) as count FROM user_votes WHERE user_id = ?", ['user-123']).count;
    console.log('Votes count (should be 1):', votesCount);

    // Test 4: Another site
    console.log('\n--- Test 4: Another Site (hytale-servs.fr) ---');
    process.env.VOTE_SECRET_HYTALESERVS = 'secret-key';
    const res4 = await fetch(`${baseUrl}/vote?site=hytale-servs.fr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret: 'secret-key',
            user: { discord: 'user-123', name: 'TestUser' },
            vote_time: Date.now()
        })
    });
    console.log('Status:', res4.status); // Expected 200

    const votesCount2 = db.get("SELECT count(*) as count FROM user_votes WHERE user_id = ?", ['user-123']).count;
    console.log('Votes count (should be 2):', votesCount2);
}
