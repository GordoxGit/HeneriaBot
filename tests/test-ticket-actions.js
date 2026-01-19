/**
 * Test script for ticket actions (Claim & Close)
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');
const config = require('../src/config');
const logger = require('../src/utils/logger');
const { claimTicket, confirmCloseTicket } = require('../src/utils/ticketManager');

// Mock Interaction
const createMockInteraction = (guildId, userId, ticketId, roleId) => {
    return {
        guild: {
            id: guildId,
            channels: {
                cache: {
                    get: (id) => ({
                        id: id,
                        send: async (msg) => { console.log(`[MockChannel ${id}] Send:`, msg.embeds ? msg.embeds[0].data : msg); },
                        delete: async () => { console.log(`[MockChannel ${id}] Deleted`); }
                    })
                }
            }
        },
        user: { id: userId, tag: `User${userId}` },
        member: {
            id: userId,
            roles: {
                cache: {
                    has: (id) => id === roleId
                }
            },
            toString: () => `<@${userId}>`
        },
        message: {
            edit: async (msg) => { console.log('[MockMessage] Edit:', msg.embeds ? msg.embeds[0].data : msg); },
            embeds: [{ title: 'Ticket', description: 'Desc', fields: [] }]
        },
        channelId: 'staff_channel',
        deferReply: async () => { console.log('[MockInteraction] DeferReply'); },
        editReply: async (msg) => { console.log('[MockInteraction] EditReply:', msg); },
        reply: async (msg) => { console.log('[MockInteraction] Reply:', msg); },
        deferUpdate: async () => { console.log('[MockInteraction] DeferUpdate'); },
        update: async (msg) => { console.log('[MockInteraction] Update:', msg); }
    };
};

async function runTests() {
  logger.info('🧪 Starting Ticket Actions Tests...');

  try {
    // Setup DB
    const dbPath = config.paths.database;
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    db.init();

    const guildId = 'guild1';
    const staffId = 'staff1';
    const staffRoleId = 'role_staff';
    const ticketChannelId = 'channel_ticket_1';

    // 1. Setup Data
    logger.info('Step 1: Setup Config & Ticket');
    db.run('INSERT INTO ticket_config (guild_id, staff_role_id) VALUES (?, ?)', [guildId, staffRoleId]);

    db.run(
        'INSERT INTO tickets (guild_id, user_id, channel_id, category, status) VALUES (?, ?, ?, ?, ?)',
        [guildId, 'user1', ticketChannelId, 'help', 'open']
    );
    const ticket = db.get('SELECT * FROM tickets WHERE guild_id = ?', [guildId]);
    const ticketId = ticket.id;
    console.log(`Ticket Created with ID: ${ticketId}`);

    // 2. Test Claim
    logger.info('Step 2: Test Claim Ticket');
    const interactionClaim = createMockInteraction(guildId, staffId, ticketId, staffRoleId);

    await claimTicket(interactionClaim, ticketId);

    const claimedTicket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (claimedTicket.status === 'claimed' && claimedTicket.staff_id === staffId) {
        logger.success('✅ Ticket claimed successfully in DB');
    } else {
        throw new Error(`Claim failed. Status: ${claimedTicket.status}, Staff: ${claimedTicket.staff_id}`);
    }

    // 3. Test Confirm Close
    logger.info('Step 3: Test Confirm Close Ticket');
    const interactionClose = createMockInteraction(guildId, staffId, ticketId, staffRoleId);

    await confirmCloseTicket(interactionClose, ticketId);

    const closedTicket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (closedTicket.status === 'closed' && closedTicket.closed_at) {
        logger.success('✅ Ticket closed successfully in DB');
    } else {
        throw new Error(`Close failed. Status: ${closedTicket.status}`);
    }

    logger.success('🎉 ✅ All ticket action tests passed');

  } catch (error) {
    logger.error(`❌ Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
