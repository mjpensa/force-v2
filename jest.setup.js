// Jest setup file for global test configuration

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key-for-testing';
process.env.PORT = '3000';
process.env.SESSION_CLEANUP_INTERVAL = '3600000';
process.env.MAX_FILE_SIZE = '10485760';
process.env.ALLOWED_FILE_TYPES = '.txt,.doc,.docx';
