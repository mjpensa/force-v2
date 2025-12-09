export default {
  // Test environment
  testEnvironment: 'node',

  // Enable ES modules support
  transform: {},

  // Coverage configuration
  collectCoverageFrom: [
    'server/**/*.js',
    'Public/**/*.js',
    '!server/prompts.js', // Exclude large prompt file from coverage
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/test/**'
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  // Coverage thresholds - realistic targets based on current implementation
  // Note: Routes have 0% coverage pending proper HTTP integration tests
  coverageThreshold: {
    global: {
      branches: 5,    // Current: 4.61%, gradually increase
      functions: 10,  // Increased threshold
      lines: 5,       // Current: 5.48%
      statements: 5,  // Current: 5.43%
    },
    // Per-module thresholds for critical components
    './server/utils.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './server/storage.js': {
      branches: 40,
      functions: 80,
      lines: 40,
      statements: 40,
    },
    './server/gemini.js': {
      branches: 40,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './server/middleware.js': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
  ],

  // Module name mapper for ES6
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Make Jest globals available in ES modules
  injectGlobals: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
