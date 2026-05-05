module.exports = {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middleWare/**/*.js",
    "models/**/*.js",
    "routes/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  testMatch: [
    "**/__tests__/**/*.test.js",
    "!**/__tests__/integration.disabled/**",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/client/",
    "/integration.disabled/",
  ],
  verbose: true,
  forceExit: process.env.JEST_FORCE_EXIT === "true",
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
};
