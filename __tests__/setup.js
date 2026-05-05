const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from actual .env file to get real behavior
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Seed test users before running tests
const seedTestUsers = require("./setup/seedTestUsers");

beforeAll(async () => {
  try {
    await seedTestUsers();
  } catch (error) {
    console.warn("Test seed skipped:", error?.message || error);
  }
});
