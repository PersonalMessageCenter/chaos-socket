const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const PROFILES_DIR = path.join(__dirname, 'profiles');
const PROFILE_NAME = process.env.CHAOS_PROFILE || 'moderate';

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
  message_types: {
    text: 1.0
  }
};

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
    logger.info(`Loaded profile: ${name}`, { 
      profileName: profile.name,
      messagesPerMinute: profile.timing?.messages_per_minute 
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
 * Select a message type based on probability distribution
 * @param {object} messageTypes - Object with type: probability pairs
 * @returns {string} Selected message type
 */
function selectMessageType(messageTypes) {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [type, probability] of Object.entries(messageTypes)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return type;
    }
  }
  
  return 'text'; // fallback
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
 * @returns {string[]} Array of unique sender emails
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

// Load the configured profile
const currentProfile = loadProfile(PROFILE_NAME);

// Generate sender pool for this profile
const senderPool = generateSenderPool(currentProfile, PROFILE_NAME);
let senderPoolIndex = 0;

/**
 * Get next sender from pool (round-robin)
 * @returns {string} Sender email
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
  loadProfile,
  listProfiles,
  randomInRange,
  selectMessageType,
  calculateMessageInterval,
  getNextSender,
  DEFAULT_PROFILE
};

