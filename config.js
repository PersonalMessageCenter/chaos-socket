const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PROFILES_DIR = path.join(__dirname, 'profiles');
const PROFILE_NAME = process.env.CHAOS_PROFILE || 'moderate';

// Default event types
const DEFAULT_EVENTS = {
  message: 0.60,
  typing: 0.10,
  read: 0.15,
  delivered: 0.10,
  presence: 0.05,
  reaction: 0.00,
  edit: 0.00,
  delete: 0.00
};

// Default profile values (fallback)
const DEFAULT_PROFILE = {
  name: 'Default',
  description: 'Default profile',
  timing: {
    messages_per_minute: 5,
    burst_probability: 0.1,
    burst_size: { min: 1, max: 3 },
    typing_delay_ms: { min: 500, max: 2000 },
    read_delay_ms: { min: 1000, max: 5000 }
  },
  presence: {
    online_probability: 0.7,
    status_change_interval_ms: 30000
  },
  events: DEFAULT_EVENTS,
  message_types: {
    text: 1.0
  }
};

// Available reactions for reaction events
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯'];

// Presence states
const PRESENCE_STATES = ['online', 'offline', 'away'];

// Typing states
const TYPING_STATES = ['composing', 'paused', 'stopped'];

/**
 * Load a profile from YAML file
 * @param {string} name - Profile name (without .yaml extension)
 * @returns {object} Profile configuration
 */
function loadProfile(name) {
  const profilePath = path.join(PROFILES_DIR, `${name}.yaml`);
  
  if (!fs.existsSync(profilePath)) {
    logger.warn(`Profile not found: ${profilePath}, using default profile`);
    return { ...DEFAULT_PROFILE, name: 'Default (fallback)' };
  }
  
  try {
    const profile = yaml.load(fs.readFileSync(profilePath, 'utf8'));
    // Merge with defaults for missing fields
    profile.events = { ...DEFAULT_EVENTS, ...profile.events };
    logger.info(`Loaded profile: ${name}`, { 
      profileName: profile.name,
      messagesPerMinute: profile.timing?.messages_per_minute,
      eventTypes: Object.keys(profile.events).filter(k => profile.events[k] > 0)
    });
    return profile;
  } catch (err) {
    logger.error(`Error loading profile: ${name}`, { error: err.message });
    return { ...DEFAULT_PROFILE, name: 'Default (error fallback)' };
  }
}

/**
 * List all available profiles
 * @returns {string[]} Array of profile names
 */
function listProfiles() {
  try {
    const files = fs.readdirSync(PROFILES_DIR);
    return files
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.replace('.yaml', ''));
  } catch (err) {
    logger.error('Error listing profiles', { error: err.message });
    return [];
  }
}

/**
 * Get random value between min and max
 * @param {object} range - Object with min and max properties
 * @returns {number} Random value in range
 */
function randomInRange(range) {
  if (typeof range === 'number') return range;
  const { min, max } = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Select from a probability distribution
 * @param {object} distribution - Object with key: probability pairs
 * @param {string} fallback - Fallback value if nothing selected
 * @returns {string} Selected key
 */
function selectFromDistribution(distribution, fallback = 'message') {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [key, probability] of Object.entries(distribution)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return key;
    }
  }
  
  return fallback;
}

/**
 * Select a message type based on probability distribution
 * @param {object} messageTypes - Object with type: probability pairs
 * @returns {string} Selected message type
 */
function selectMessageType(messageTypes) {
  return selectFromDistribution(messageTypes, 'text');
}

/**
 * Select an event type based on probability distribution
 * @param {object} events - Object with event: probability pairs
 * @returns {string} Selected event type
 */
function selectEventType(events) {
  return selectFromDistribution(events, 'message');
}

/**
 * Get a random reaction emoji
 * @returns {string} Random emoji
 */
function getRandomReaction() {
  return REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
}

/**
 * Get a random presence state
 * @returns {string} Random presence state
 */
function getRandomPresenceState() {
  return PRESENCE_STATES[Math.floor(Math.random() * PRESENCE_STATES.length)];
}

/**
 * Get a random typing state
 * @returns {string} Random typing state
 */
function getRandomTypingState() {
  return TYPING_STATES[Math.floor(Math.random() * TYPING_STATES.length)];
}

/**
 * Calculate message interval in ms based on messages per minute
 * @param {number} messagesPerMinute 
 * @returns {number} Interval in milliseconds
 */
function calculateMessageInterval(messagesPerMinute) {
  if (messagesPerMinute <= 0) return 60000; // 1 minute fallback
  return Math.floor(60000 / messagesPerMinute);
}

/**
 * Generate a pool of unique senders
 * @param {object} profile - Profile configuration
 * @param {string} profileName - Profile name
 * @returns {string[]} Array of unique sender identifiers
 * @throws {Error} If sender configuration is missing
 */
function generateSenderPool(profile, profileName) {
  if (!profile.sender?.count) {
    throw new Error(`Profile '${profileName}' must define 'sender.count'`);
  }
  
  const senderCount = profile.sender.count;
  
  const pool = [];
  for (let i = 0; i < senderCount; i++) {
    pool.push(`sender_${i}_${Math.floor(Math.random() * 1000)}@example.com`);
  }
  
  logger.info(`Generated sender pool for profile '${profileName}'`, {
    poolSize: pool.length
  });
  
  return pool;
}

/**
 * Generate a unique chat/conversation ID
 * @returns {string} Chat ID
 */
function generateChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique message ID
 * @returns {string} Message ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Load the configured profile
const currentProfile = loadProfile(PROFILE_NAME);

// Generate sender pool for this profile
const senderPool = generateSenderPool(currentProfile, PROFILE_NAME);
let senderPoolIndex = 0;

// Message history for read/reaction/edit/delete events (circular buffer)
const MESSAGE_HISTORY_SIZE = 100;
const messageHistory = [];

/**
 * Add a message to history (for referencing in read/reaction events)
 * @param {object} message - Message object with id, sender, chat
 */
function addToMessageHistory(message) {
  messageHistory.push({
    id: message.id,
    sender: message.sender,
    chat: message.chat || 'default_chat',
    timestamp: message.timestamp
  });
  
  // Keep only last N messages
  if (messageHistory.length > MESSAGE_HISTORY_SIZE) {
    messageHistory.shift();
  }
}

/**
 * Get a random message from history
 * @returns {object|null} Random message or null if history is empty
 */
function getRandomFromHistory() {
  if (messageHistory.length === 0) return null;
  return messageHistory[Math.floor(Math.random() * messageHistory.length)];
}

/**
 * Get next sender from pool (round-robin)
 * @returns {string} Sender identifier
 */
function getNextSender() {
  const sender = senderPool[senderPoolIndex];
  senderPoolIndex = (senderPoolIndex + 1) % senderPool.length;
  return sender;
}

module.exports = {
  profile: currentProfile,
  profileName: PROFILE_NAME,
  senderPool,
  messageHistory,
  loadProfile,
  listProfiles,
  randomInRange,
  selectFromDistribution,
  selectMessageType,
  selectEventType,
  calculateMessageInterval,
  getNextSender,
  getRandomReaction,
  getRandomPresenceState,
  getRandomTypingState,
  generateChatId,
  generateMessageId,
  addToMessageHistory,
  getRandomFromHistory,
  DEFAULT_PROFILE,
  DEFAULT_EVENTS,
  REACTIONS,
  PRESENCE_STATES,
  TYPING_STATES
};
