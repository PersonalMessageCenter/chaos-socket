const request = require('supertest');

// Mock config module before requiring index
jest.mock('./config', () => ({
  profile: {
    name: 'Test',
    description: 'Test profile',
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
    message_types: { text: 1.0 }
  },
  profileName: 'test',
  profilesDir: './profiles',
  loadProfile: jest.fn((name) => ({
    name: name,
    description: `${name} profile`,
    timing: { messages_per_minute: 5 }
  })),
  listProfiles: jest.fn(() => ['idle', 'moderate', 'busy', 'group', 'flood']),
  randomInRange: jest.fn((range) => {
    if (typeof range === 'number') return range;
    return range.min;
  }),
  selectMessageType: jest.fn(() => 'text'),
  calculateMessageInterval: jest.fn((mpm) => Math.floor(60000 / mpm)),
  DEFAULT_PROFILE: {}
}));

// Mock WebSocket
jest.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // OPEN
    }
    send(data) {
      // Mock send
    }
    close() {
      this.readyState = 3; // CLOSED
    }
  }
  class MockWebSocketServer extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
    }
    close(callback) {
      if (callback) callback();
    }
  }
  return { 
    Server: MockWebSocketServer,
    OPEN: 1,
    CLOSED: 3
  };
});

// Mock logger
jest.mock('./logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { apiApp, activeConnectionsMap } = require('./index');

describe('Chaos Socket API Endpoints', () => {
  beforeEach(() => {
    // Clear connections before each test
    activeConnectionsMap.clear();
    
    // Add mock WebSocket connections
    const mockWs1 = {
      readyState: 1, // OPEN
      send: jest.fn(),
    };
    const mockWs2 = {
      readyState: 1, // OPEN
      send: jest.fn(),
    };
    activeConnectionsMap.set('conn1', mockWs1);
    activeConnectionsMap.set('conn2', mockWs2);
  });

  afterEach(() => {
    activeConnectionsMap.clear();
  });

  describe('POST /api/send-message', () => {
    it('should return 400 when message is missing', async () => {
      const response = await request(apiApp)
        .post('/api/send-message')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Message is required');
    });

    it('should send message to all connections when connectionId is not provided', async () => {
      const response = await request(apiApp)
        .post('/api/send-message')
        .send({
          message: {
            id: 'msg_123',
            type: 'text',
            content: 'Test message'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('sent', 2);
      expect(response.body).toHaveProperty('activeConnections', 2);
    });

    it('should send message to specific connection when connectionId is provided', async () => {
      const response = await request(apiApp)
        .post('/api/send-message')
        .send({
          message: {
            id: 'msg_456',
            type: 'text',
            content: 'Test message'
          },
          connectionId: 'conn1'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.sent).toBe(1);
      expect(response.body.activeConnections).toBe(2);
    });

    it('should not send to closed connections', async () => {
      // Set one connection as closed
      const closedWs = activeConnectionsMap.get('conn1');
      closedWs.readyState = 3; // CLOSED

      const response = await request(apiApp)
        .post('/api/send-message')
        .send({
          message: {
            id: 'msg_789',
            type: 'text',
            content: 'Test message'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.sent).toBe(1); // Only conn2 should receive
      expect(response.body.activeConnections).toBe(2);
    });
  });

  describe('GET /api/status', () => {
    it('should return status with active connections and profile info', async () => {
      const response = await request(apiApp)
        .get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activeConnections', 2);
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('name', 'test');
    });

    it('should reflect current connection count', async () => {
      activeConnectionsMap.clear();
      
      const response = await request(apiApp)
        .get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.activeConnections).toBe(0);
    });
  });

  describe('GET /api/profiles', () => {
    it('should return list of available profiles', async () => {
      const response = await request(apiApp)
        .get('/api/profiles');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('current', 'test');
      expect(response.body).toHaveProperty('available');
      expect(response.body.available).toContain('idle');
      expect(response.body.available).toContain('busy');
    });
  });

  describe('GET /api/profile/:name', () => {
    it('should return profile details', async () => {
      const response = await request(apiApp)
        .get('/api/profile/busy');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'busy');
    });
  });
});
