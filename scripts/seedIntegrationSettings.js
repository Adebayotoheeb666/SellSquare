/**
 * Seeds IntegrationSettings for SUPERADMIN_BUSINESS_ID from env vars.
 * Run once after credentials change: node scripts/seedIntegrationSettings.js
 */
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.automation" });

const mongoose = require("mongoose");
const IntegrationSettings = require("../models/integrationSettingsModel");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const platformId = process.env.SUPERADMIN_BUSINESS_ID;
  if (!platformId) throw new Error("SUPERADMIN_BUSINESS_ID not set");

  const update = {
    // TikTok — reads ONLY from DB
    "tiktok.accessToken": process.env.TIKTOK_ACCESS_TOKEN || null,
    "tiktok.refreshToken": process.env.TIKTOK_REFRESH_TOKEN || null,
    "tiktok.clientId": process.env.TIKTOK_CLIENT_ID || null,
    "tiktok.apiSecret": process.env.TIKTOK_CLIENT_SECRET || null,
    "tiktok.enabled": !!(process.env.TIKTOK_ACCESS_TOKEN),
    "tiktok.status": process.env.TIKTOK_ACCESS_TOKEN ? "connected" : "disconnected",

    // Instagram — reads ONLY from DB
    "instagram.accessToken": process.env.INSTAGRAM_ACCESS_TOKEN || null,
    "instagram.businessAccountId": process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || null,
    "instagram.appId": process.env.INSTAGRAM_APP_ID || null,
    "instagram.appSecret": process.env.INSTAGRAM_APP_SECRET || null,
    "instagram.enabled": !!(process.env.INSTAGRAM_ACCESS_TOKEN),
    "instagram.status": process.env.INSTAGRAM_ACCESS_TOKEN ? "connected" : "disconnected",

    // ElevenLabs — falls back to env but DB wins
    "elevenLabs.apiKey": process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || null,
    "elevenLabs.voiceId": process.env.ELEVEN_LABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || null,
    "elevenLabs.enabled": !!(process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY),
    "elevenLabs.status": (process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY) ? "connected" : "disconnected",

    // WhatsApp — reads ONLY from DB
    "whatsapp.accessToken": process.env.WHATSAPP_ACCESS_TOKEN || null,
    "whatsapp.businessPhoneNumberId": process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    "whatsapp.enabled": !!(process.env.WHATSAPP_ACCESS_TOKEN),
    "whatsapp.status": process.env.WHATSAPP_ACCESS_TOKEN ? "connected" : "disconnected",

    // Email
    "email.enabled": true,
    "email.provider": "custom_smtp",
    "email.senderEmail": process.env.SMTP_USER || process.env.EMAIL_FROM || null,
    "email.senderName": "SellSquare",
    "email.status": process.env.SMTP_USER ? "connected" : "disconnected",
  };

  const result = await IntegrationSettings.findOneAndUpdate(
    { business: platformId },
    { $set: update },
    { upsert: true, new: true }
  );

  console.log("\n✅ IntegrationSettings seeded for platform ID:", platformId);
  console.log("TikTok token set:    ", !!(result.tiktok?.accessToken));
  console.log("Instagram token set: ", !!(result.instagram?.accessToken));
  console.log("ElevenLabs key set:  ", !!(result.elevenLabs?.apiKey));
  console.log("WhatsApp token set:  ", !!(result.whatsapp?.accessToken));
  console.log("Email sender set:    ", !!(result.email?.senderEmail));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
