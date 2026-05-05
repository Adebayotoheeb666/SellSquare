/**
 * Migration Script: Populate Email Model from Existing Business Data
 *
 * This script iterates all BusinessRegistration documents and creates
 * Email records for each business owner and sales rep.
 *
 * Rules:
 *   - Business owner email → isAdmin: true
 *   - Sales rep email → isAdmin: false
 *   - If an email already exists in the Email model, it is skipped (owner wins)
 *   - Conflicts (same email across multiple businesses) are logged for review
 *
 * Usage:
 *   node scripts/migrateEmails.js
 *
 * Environment:
 *   Requires MONGO_URI in .env (or the same env vars as the main app)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const BusinessRegistration = require("../models/businessRegistration");
const Email = require("../models/emailModel");

const MONGO_URI = process.env.MONGO_URI;

async function migrateEmails() {
  console.log("=== Email Migration Script ===\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  const businesses = await BusinessRegistration.find().lean();
  console.log(`Found ${businesses.length} businesses to process\n`);

  let created = 0;
  let skipped = 0;
  const conflicts = [];

  for (const business of businesses) {
    // Process business owner
    const ownerEmail = business.businessOwner?.email?.toLowerCase()?.trim();
    if (ownerEmail) {
      try {
        const existing = await Email.findOne({ email: ownerEmail });
        if (existing) {
          if (existing.business.toString() !== business._id.toString()) {
            conflicts.push({
              email: ownerEmail,
              existingBusiness: existing.business.toString(),
              newBusiness: business._id.toString(),
              role: "owner",
              existingIsAdmin: existing.isAdmin,
            });
            // If existing record is NOT admin but this one IS, upgrade it
            if (!existing.isAdmin) {
              await Email.updateOne(
                { email: ownerEmail },
                { business: business._id, isAdmin: true }
              );
              console.log(`  UPGRADED: ${ownerEmail} → admin for ${business.businessName}`);
            } else {
              console.log(`  CONFLICT: ${ownerEmail} already admin in another business, skipping`);
              skipped++;
            }
          } else {
            skipped++;
          }
        } else {
          await Email.create({
            email: ownerEmail,
            business: business._id,
            isAdmin: true,
          });
          created++;
          console.log(`  CREATED: ${ownerEmail} → admin for ${business.businessName}`);
        }
      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          console.error(`  ERROR processing owner ${ownerEmail}:`, err.message);
        }
      }
    }

    // Process sales reps
    for (const rep of business.salesRep || []) {
      const repEmail = rep.email?.toLowerCase()?.trim();
      if (!repEmail) continue;

      try {
        const existing = await Email.findOne({ email: repEmail });
        if (existing) {
          if (existing.business.toString() !== business._id.toString()) {
            conflicts.push({
              email: repEmail,
              existingBusiness: existing.business.toString(),
              newBusiness: business._id.toString(),
              role: "salesRep",
              existingIsAdmin: existing.isAdmin,
            });
            console.log(`  CONFLICT: ${repEmail} exists in another business, skipping`);
          }
          skipped++;
        } else {
          await Email.create({
            email: repEmail,
            business: business._id,
            isAdmin: false,
          });
          created++;
          console.log(`  CREATED: ${repEmail} → salesRep for ${business.businessName}`);
        }
      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          console.error(`  ERROR processing salesRep ${repEmail}:`, err.message);
        }
      }
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Conflicts: ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log("\n=== Conflicts (need manual review) ===");
    for (const c of conflicts) {
      console.log(
        `  ${c.email}: ${c.role} in business ${c.newBusiness}, ` +
        `but already ${c.existingIsAdmin ? "admin" : "salesRep"} in ${c.existingBusiness}`
      );
    }
  }

  await mongoose.disconnect();
  console.log("\nDone. Disconnected from MongoDB.");
}

migrateEmails().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
