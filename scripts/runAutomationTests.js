#!/usr/bin/env node

/**
 * ============================================================================
 * AUTOMATION SYSTEM TEST RUNNER
 * ============================================================================
 * 
 * This script runs the complete automation system test suite and provides
 * a detailed report of all tested features and their status.
 * 
 * Usage:
 *   node scripts/runAutomationTests.js
 *   node scripts/runAutomationTests.js --verbose
 *   node scripts/runAutomationTests.js --coverage
 *   node scripts/runAutomationTests.js --suite "Campaign Management"
 * 
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  log("", "reset");
  log("═".repeat(80), "cyan");
  log(`  ${title}`, "bright");
  log("═".repeat(80), "cyan");
}

function section(title) {
  log(`\n► ${title}`, "blue");
  log("-".repeat(title.length + 2), "blue");
}

function success(message) {
  log(`✓ ${message}`, "green");
}

function error(message) {
  log(`✗ ${message}`, "red");
}

function warning(message) {
  log(`⚠ ${message}`, "yellow");
}

function info(message) {
  log(`ℹ ${message}`, "cyan");
}

// Collect test suites
const testSuites = {
  "Channel Integration Connection Tests": {
    description: "Test all 5 integration channels (TikTok, Instagram, WhatsApp, Email, 11Labs)",
    tests: [
      "TikTok Integration",
      "Instagram Integration",
      "WhatsApp Integration",
      "Email Integration",
      "11Labs Integration",
      "Get Integration Status",
    ],
    count: 15,
  },
  "Social Media Automation Tests": {
    description: "Test TikTok and Instagram monitoring, engagement, insights, and ideas",
    tests: [
      "TikTok Automation",
      "Instagram Automation",
    ],
    count: 12,
  },
  "Content Publishing Tests": {
    description: "Test content approval, publishing, scheduling, and 11Labs integration",
    tests: [
      "Content approval and publishing",
      "11Labs audio generation",
      "Multi-platform publishing",
      "Scheduled publishing",
    ],
    count: 6,
  },
  "Registration Follow-up Automation Tests": {
    description: "Test email and WhatsApp follow-ups with tracking and management",
    tests: [
      "Email Follow-ups",
      "WhatsApp Follow-ups",
      "Follow-up Sequence Management",
    ],
    count: 11,
  },
  "Campaign Management Tests": {
    description: "Test campaign creation, activation, recipients, and metrics",
    tests: [
      "Campaign CRUD operations",
      "Campaign activation/pausing",
      "Recipient management",
      "Campaign metrics and duplication",
    ],
    count: 8,
  },
  "Webhook Handling Tests": {
    description: "Test WhatsApp webhook handling for delivery and read status",
    tests: ["WhatsApp webhooks"],
    count: 2,
  },
  "Automation Scheduler Tests": {
    description: "Test scheduling of TikTok, Instagram, follow-up, and publishing jobs",
    tests: ["Job scheduling"],
    count: 4,
  },
  "End-to-End Automation Flows": {
    description: "Test complete workflows from monitoring to publishing",
    tests: [
      "TikTok to publishing flow",
      "Registration to follow-up flow",
      "Campaign metrics tracking",
    ],
    count: 3,
  },
  "Error Handling and Failure Recovery": {
    description: "Test API failures, retries, and graceful degradation",
    tests: ["Error handling and retries"],
    count: 3,
  },
  "Data Validation Tests": {
    description: "Test input validation and business logic validation",
    tests: ["Data validation"],
    count: 3,
  },
  "Multi-Business Data Isolation": {
    description: "Test multi-tenant isolation and data security",
    tests: ["Business data isolation"],
    count: 3,
  },
};

// Parse arguments
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const coverage = args.includes("--coverage");
const specificSuite = args.find((arg) => arg.startsWith("--suite"))?.split("=")[1];

function buildCommand() {
  let cmd = "npm test -- __tests__/automation/automationSystemEndToEnd.test.js";

  if (specificSuite) {
    cmd += ` -t "${specificSuite}"`;
  }

  if (verbose) {
    cmd += " --verbose";
  }

  if (coverage) {
    cmd += " --coverage";
  }

  // Add no-coverage flag to speed up tests if not explicitly requested
  if (!coverage) {
    cmd += " --no-coverage";
  }

  return cmd;
}

function calculateTotalTests() {
  return Object.values(testSuites).reduce((sum, suite) => sum + suite.count, 0);
}

function displayTestSummary() {
  header("AUTOMATION SYSTEM TEST SUITE");
  log("Comprehensive testing for SellSquare automation features", "dim");

  section("Test Suites Overview");

  let totalTests = 0;
  Object.entries(testSuites).forEach(([name, suite]) => {
    log(`\n${name}`, "bright");
    log(suite.description, "dim");
    info(`${suite.count} test cases`);
    totalTests += suite.count;
  });

  section("Test Statistics");
  info(`Total test cases: ${totalTests}`);
  info(`Coverage areas: ${Object.keys(testSuites).length}`);
}

function displayIntegrationChecklist() {
  section("Integration Verification Checklist");

  const checklist = [
    {
      category: "Channel Connections (5/5)",
      items: [
        "TikTok connects and disconnects",
        "Instagram connects and disconnects",
        "WhatsApp connects and disconnects",
        "Email connects and disconnects",
        "11Labs connects and disconnects",
      ],
    },
    {
      category: "Social Media Monitoring (2/2)",
      items: [
        "TikTok posts are fetched and monitored",
        "Instagram posts are fetched and monitored",
      ],
    },
    {
      category: "Engagement (2/2)",
      items: [
        "TikTok engagement (likes and comments) works",
        "Instagram engagement (likes and comments) works",
      ],
    },
    {
      category: "Insights & Ideas (2/2)",
      items: [
        "Insights are generated from engagement",
        "Content ideas are created from insights",
      ],
    },
    {
      category: "Content Publishing (2/2)",
      items: [
        "Content is published to TikTok with 11Labs audio",
        "Content is published to Instagram",
      ],
    },
    {
      category: "Registration Follow-ups (2/2)",
      items: [
        "Email follow-ups are sent on schedule",
        "WhatsApp follow-ups are sent on schedule",
      ],
    },
    {
      category: "Campaign Management (1/1)",
      items: [
        "Campaigns are created, activated, and metrics tracked",
      ],
    },
    {
      category: "Scheduling (4/4)",
      items: [
        "TikTok automation runs every 6 hours",
        "Instagram automation runs daily at 3 AM",
        "Follow-up processing runs every 30 minutes",
        "Content publishing runs every 4 hours",
      ],
    },
  ];

  checklist.forEach((section) => {
    log(`\n${section.category}`, "cyan");
    section.items.forEach((item) => {
      log(`  [ ] ${item}`, "dim");
    });
  });

  log("\n" + "═".repeat(80), "cyan");
}

function runTests() {
  const cmd = buildCommand();

  header("RUNNING TESTS");
  info(`Command: ${cmd}`);
  log("", "reset");

  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (error) {
    return false;
  }
}

function displayResults(success) {
  header("TEST RESULTS");

  if (success) {
    success("All tests passed!");
    log("", "reset");
    section("System Status");
    success("TikTok automation - OPERATIONAL");
    success("Instagram automation - OPERATIONAL");
    success("WhatsApp automation - OPERATIONAL");
    success("Email automation - OPERATIONAL");
    success("11Labs integration - OPERATIONAL");
    success("Content publishing - OPERATIONAL");
    success("Campaign management - OPERATIONAL");
    log("", "reset");
  } else {
    error("Some tests failed!");
    log("", "reset");
    section("Troubleshooting");
    log("1. Review the error messages above for specific failures", "dim");
    log("2. Run with --verbose for more detailed output", "dim");
    log("3. Run specific test suite with --suite=\"Suite Name\"", "dim");
    log("4. Check integration configurations in your environment", "dim");
    log("", "reset");
  }
}

function displayUsageGuide() {
  section("Usage Examples");
  log(`  # Run all tests\n  npm test -- __tests__/automation/automationSystemEndToEnd.test.js`, "dim");
  log(`\n  # Run specific test suite\n  npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "TikTok Automation"`, "dim");
  log(`\n  # Run with coverage report\n  npm test -- __tests__/automation/automationSystemEndToEnd.test.js --coverage`, "dim");
  log(`\n  # Run with this script\n  node scripts/runAutomationTests.js --verbose`, "dim");
  log("", "reset");
}

// Main execution
function main() {
  if (specificSuite) {
    info(`Running specific test suite: ${specificSuite}\n`);
  }

  displayTestSummary();

  if (!specificSuite) {
    displayIntegrationChecklist();
  }

  section("Execution");
  const testSuccess = runTests();

  displayResults(testSuccess);

  if (!specificSuite) {
    displayUsageGuide();
  }

  process.exit(testSuccess ? 0 : 1);
}

// Run the script
main();
