const { createTicket } = require('../src/utils/ticketManager');
const db = require('../src/database/db');
const config = require('../src/config');
const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

// Setup test DB
const TEST_DB_PATH = './tests/output/test_tickets.db';
config.paths.database = TEST_DB_PATH;

// Ensure directory exists
if (!fs.existsSync(path.dirname(TEST_DB_PATH))) {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
}
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Init DB (this creates tables)
db.init();

// Insert test data
// ticket_config: guild_id, panel_channel_id, panel_message_id, staff_channel_id, log_channel_id, staff_role_id
db.run(`INSERT INTO ticket_config (guild_id, staff_role_id, staff_channel_id) VALUES ('guild1', 'role1', 'channel_staff')`);
// ticket_categories: guild_id, category_id, emoji, label, type, enabled
db.run(`INSERT INTO ticket_categories (guild_id, category_id, type, label, enabled) VALUES ('guild1', 'cat1', 'help', 'Aide', 1)`);

// Mock objects
const mockChannel = {
  id: 'new_ticket_channel',
  send: async (msg) => {
    // console.log('Channel send:', msg);
    return { id: 'msg1' };
  }
};

const mockGuild = {
  id: 'guild1',
  name: 'Test Guild',
  channels: {
    create: async (options) => {
      console.log('Creating channel with name:', options.name);
      console.log('Parent:', options.parent);
      return mockChannel;
    },
    cache: {
      get: (id) => {
        if (id === 'channel_staff') return {
          id: 'channel_staff',
          send: async (msg) => {
            // console.log('Staff channel send:', msg);
            if (msg.embeds[0].data.title === '🔔 Nouveau Ticket') {
                console.log('Staff notification sent');
            }
          }
        };
        return null;
      }
    }
  }
};

const mockUser = {
  id: 'user1',
  tag: 'User#1234',
  username: 'User'
};

const mockMember = {
  id: 'user1',
  tag: 'User#1234',
  guild: mockGuild,
  toString: () => '<@user1>'
};

const mockInteraction = {
  guild: mockGuild,
  member: mockMember,
  user: mockUser,
  customId: 'ticket_help',
  client: { user: { id: 'bot_id' } },
  reply: async (msg) => console.log('Reply:', msg.content || msg.embeds[0].data.description),
  deferReply: async (opts) => {
      // console.log('Defer:', opts);
      mockInteraction.deferred = true;
  },
  editReply: async (msg) => console.log('EditReply:', msg.content || msg.embeds[0].data.description),
  deferred: false
};

// Run test
(async () => {
  try {
    console.log('--- TEST START ---');
    console.log('Running createTicket...');
    await createTicket(mockInteraction, 'help');

    // Verify DB
    const ticket = db.get('SELECT * FROM tickets WHERE user_id = ?', ['user1']);
    console.log('Ticket in DB:', ticket);

    if (ticket && ticket.status === 'open' && ticket.category === 'help') {
      console.log('SUCCESS: Ticket created in DB');
    } else {
      console.error('FAILURE: Ticket not found or incorrect in DB');
      process.exit(1);
    }

    // Verify second creation attempt fails
    console.log('\nRunning createTicket again (should fail)...');
    mockInteraction.deferred = false;

    // Mocking a fresh interaction for the second call
    const mockInteraction2 = {
        ...mockInteraction,
        deferred: false,
        reply: async (msg) => {
            const desc = msg.embeds[0].data.description;
            console.log('Reply 2:', desc);
            if (desc.includes('Vous avez déjà un ticket ouvert')) {
                console.log('SUCCESS: Prevented duplicate ticket');
            } else {
                console.error('FAILURE: Did not prevent duplicate ticket');
                process.exit(1);
            }
        }
    };

    await createTicket(mockInteraction2, 'help');

    console.log('\n--- TEST COMPLETE ---');
    db.close();
  } catch (error) {
    console.error('Test crashed:', error);
    db.close();
    process.exit(1);
  }
})();
