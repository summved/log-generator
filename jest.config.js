/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  transform: {
    // TypeScript sources, plus ESM-only dependencies (faker, uuid) compiled to CommonJS for Jest
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: { allowJs: true } }]
  },
  transformIgnorePatterns: ['/node_modules/(?!(@faker-js/faker|uuid)/)']
};
