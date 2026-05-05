/**
 * Connection test script — runs outside HTTP, no auth token needed.
 * Usage: node scripts/testConnections.js
 */
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.automation" }); // automation vars override if present

const mongoose = require("mongoose");

const tiktokService = require("../services/tiktok/tiktokService");
const instagramService = require("../services/instagram/instagramService");
const whatsappService = require("../services/whatsapp/whatsappService");
const elevenlabsService = require("../services/elevenlabs/elevenlabsService");
const nodemailer = require("nodemailer");

const PLATFORM_ID = process.env.SUPERADMIN_BUSINESS_ID;

const results = {};

function pass(name, detail) {
  results[name] = { status: "✅ CONNECTED", detail };
}
function fail(name, detail) {
  results[name] = { status: "❌ FAILED", detail };
}

// ── TikTok ──────────────────────────────────────────────────────────────────
async function testTikTok() {
  try {
    const result = await tiktokService.testConnection(PLATFORM_ID);
    if (result?.success || result?.connected) {
      pass("TikTok", result.message || result.username || "OK");
    } else {
      fail("TikTok", result?.message || JSON.stringify(result));
    }
  } catch (err) {
    fail("TikTok", err.message);
  }
}

// ── Instagram ────────────────────────────────────────────────────────────────
async function testInstagram() {
  try {
    const result = await instagramService.testConnection(PLATFORM_ID);
    if (result?.success || result?.connected) {
      pass("Instagram", result.message || result.username || "OK");
    } else {
      fail("Instagram", result?.message || JSON.stringify(result));
    }
  } catch (err) {
    fail("Instagram", err.message);
  }
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────
async function testWhatsApp() {
  try {
    const result = await whatsappService.testConnection(PLATFORM_ID);
    if (result?.success || result?.connected) {
      pass("WhatsApp", result.message || result.phoneNumber || "OK");
    } else {
      fail("WhatsApp", result?.message || JSON.stringify(result));
    }
  } catch (err) {
    fail("WhatsApp", err.message);
  }
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────
async function testElevenLabs() {
  try {
    const result = await elevenlabsService.testConnection
      ? await elevenlabsService.testConnection(PLATFORM_ID)
      : await elevenlabsService.getVoices(PLATFORM_ID);

    if (result?.success || Array.isArray(result?.voices) || Array.isArray(result)) {
      const voiceCount = result?.voices?.length ?? (Array.isArray(result) ? result.length : "?");
      pass("ElevenLabs", `${voiceCount} voice(s) available`);
    } else {
      fail("ElevenLabs", result?.message || JSON.stringify(result));
    }
  } catch (err) {
    fail("ElevenLabs", err.message);
  }
}

// ── Email (SMTP) ──────────────────────────────────────────────────────────────
async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    await transporter.verify();
    pass("Email (SMTP)", `${process.env.SMTP_USER} via ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
  } catch (err) {
    fail("Email (SMTP)", err.message);
  }
}

// ── Run all ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔌 SellSquare Integration Connection Tests\n" + "─".repeat(50));
  console.log(`Platform ID: ${PLATFORM_ID || "(not set — SUPERADMIN_BUSINESS_ID missing)"}\n`);

  // Connect mongoose only if any service needs DB (whatsapp reads IntegrationSettings)
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI).catch(() => {});
  }

  await Promise.allSettled([
    testTikTok(),
    testInstagram(),
    testWhatsApp(),
    testElevenLabs(),
    testEmail(),
  ]);

  await mongoose.disconnect().catch(() => {});

  console.log("─".repeat(50));
  for (const [name, { status, detail }] of Object.entries(results)) {
    console.log(`${status}  ${name}`);
    console.log(`         ${detail}\n`);
  }
  console.log("─".repeat(50) + "\n");

  const failures = Object.values(results).filter((r) => r.status.startsWith("❌")).length;
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
