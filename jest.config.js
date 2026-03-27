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
      branches: 30,
      functions: 40,
      lines: 35,
      statements: 35,
    },
    './server/utils.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
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
