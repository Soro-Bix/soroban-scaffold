/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        injectGlobals: true,
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts', '**/__tests__/**/*.test.ts', '**/*.test.ts'],
  // Integration tests compile real Rust projects and take minutes; they run
  // via `npm run test:integration`, not on every unit run.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/integration/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  passWithNoTests: true,
};
