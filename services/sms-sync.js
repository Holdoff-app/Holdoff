/**
 * SMS sync service for HoldOff.
 * 
 * Current implementation: Mock/test data loader.
 * 
 * Future integrations:
 * - Twilio API (if user has Twilio account)
 * - IFTTT webhook (SMS → JSON POST)
 * - React Native platform SMS API (native app)
 * - Vonage/Nexmo
 */

const { 
  insertMessage, 
  getOrCreateThread, 
  upsertContact 
} = require('../db/messages');

/**
 * Load mock SMS conversation for testing.
 * Returns array of SMS objects: { from, to, body, timestamp }
 */
function generateMockSMS(phoneNumber) {
  const now = new Date();
  const messages = [
    {
      from: phoneNumber,
      to: 'user',
      body: 'hey did you see my last message',
      timestamp: new Date(now - 15 * 60000),
    },
    {
      from: phoneNumber,
      to: 'user',
      body: 'hello?',
      timestamp: new Date(now - 12 * 60000),
    },
    {
      from: phoneNumber,
      to: 'user',
      body: 'why arent you responding',
      timestamp: new Date(now - 8 * 60000),
    },
    {
      from: 'user',
      to: phoneNumber,
      body: 'sorry just saw this',
      timestamp: new Date(now - 5 * 60000),
    },
    {
      from: phoneNumber,
      to: 'user',
      body: 'its fine, when do you want to hang',
      timestamp: new Date(now - 2 * 60000),
    },
  ];
  return messages;
}

/**
 * Sync SMS thread from external source (or mock).
 * 
 * @param {number} userId - User ID
 * @param {object} contact - Contact object { name, phoneNumber }
 * @param {object} options - Sync options
 *   - useMock: boolean (use test data instead of real API)
 *   - externalMessages: array (pre-loaded messages)
 * @returns {object} Thread with messages loaded
 */
async function syncSMSThread(userId, contact, options = {}) {
  try {
    const { useMock = true, externalMessages = null } = options;

    // Upsert contact
    const savedContact = await upsertContact(userId, {
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      isFavorited: false,
    });

    // Get or create thread
    const thread = await getOrCreateThread(userId, savedContact.id);

    // Load messages (mock or external)
    let messages = externalMessages || (useMock ? generateMockSMS(contact.phoneNumber) : []);

    // Insert messages into thread
    for (const msg of messages) {
      const senderType = msg.from === contact.phoneNumber ? 'contact' : 'user';
      await insertMessage(thread.id, {
        senderType,
        body: msg.body,
        externalId: msg.externalId || null,
        timestamp: msg.timestamp || new Date(),
      });
    }

    console.log(`[SMS] Synced ${messages.length} messages for thread ${thread.id}`);

    return {
      threadId: thread.id,
      contactId: savedContact.id,
      contactName: savedContact.name,
      phoneNumber: savedContact.phone_number,
      messageCount: messages.length,
    };
  } catch (err) {
    console.error('[SMS] Sync error:', err.message);
    throw err;
  }
}

/**
 * Twilio integration stub (future).
 */
async function syncViaTwilio(userId, contact, twilioClient) {
  // TODO: Implement Twilio API call
  // const messages = await twilioClient.messages.list({ from: contact.phoneNumber });
  // Then call syncSMSThread with externalMessages = messages
  throw new Error('Twilio sync not yet implemented');
}

/**
 * IFTTT webhook stub (future).
 */
async function setupIFTTTWebhook(userId, webhookUrl) {
  // TODO: Register webhook URL in user preferences
  // Incoming SMS will POST to webhookUrl with { from, to, body, timestamp }
  throw new Error('IFTTT webhook not yet implemented');
}

/**
 * Health check: Test SMS sync connectivity.
 */
async function healthCheck() {
  try {
    // Mock data generation works
    const mockMsgs = generateMockSMS('+15551234567');
    if (mockMsgs.length === 0) throw new Error('Mock SMS generation failed');
    return { ok: true, messageCount: mockMsgs.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  syncSMSThread,
  syncViaTwilio,
  setupIFTTTWebhook,
  generateMockSMS,
  healthCheck,
};
