import baseConfig from './jest.config.js';

/** @type {import('jest').Config} */
export default {
  ...baseConfig,
  testMatch: ['**/tests/integration/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Each scaffolded project compiles the full soroban-sdk dependency tree.
  testTimeout: 900_000,
  maxWorkers: 1,
};
