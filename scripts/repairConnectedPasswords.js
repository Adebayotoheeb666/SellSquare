/**
 * Repair Script: Fix double-hashed passwords on connected stores
 *
 * The earlier connectStore and registerAndConnectStore implementations
 * used .save()/.create() which triggered the pre-save hook and double-hashed
 * passwords that were already hashed (copied from the primary business).
 *
 * This script finds all businesses that are in a connectedStores relationship
 * and copies the root owner's valid password to any connected store that
 * shares the same owner email.
 *
 * Usage:
 *   node scripts/repairConnectedPasswords.js
 */

require("dotenv").config()
const mongoose = require("mongoose");
const BusinessRegistration = require("../models/businessRegistration");

const MONGO_URI = process.env.MONGO_URI;

async function repairPasswords() {
  console.log("=== Connected Store Password Repair ===\n");

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  // Find all businesses that have connected stores
  const rootBusinesses = await BusinessRegistration.find({
    connectedStores: { $exists: true, $ne: [] },
  }).lean();

  console.log(`Found ${rootBusinesses.length} businesses with connected stores\n`);

  let repaired = 0;
  let skipped = 0;

  for (const root of rootBusinesses) {
    const rootEmail = root.businessOwner?.email?.toLowerCase().trim();
    const rootPassword = root.businessOwner?.password;

    if (!rootEmail || !rootPassword) {
      console.log(`  SKIP ${root.businessName} (${root._id}) - no owner email/password`);
      skipped++;
      continue;
    }

    for (const connectedId of root.connectedStores) {
      const connected = await BusinessRegistration.findById(connectedId).lean();
      if (!connected) continue;

      const connectedEmail = connected.businessOwner?.email?.toLowerCase().trim();

      // Only repair if same owner email but different password
      if (connectedEmail === rootEmail && connected.businessOwner.password !== rootPassword) {
        console.log(`  REPAIR "${connected.businessName}" (${connected._id}) - password mismatch, copying from "${root.businessName}"`);

        await BusinessRegistration.updateOne(
          { _id: connected._id },
          { $set: { "businessOwner.password": rootPassword } }
        );
        repaired++;
      } else if (connectedEmail === rootEmail) {
        console.log(`  OK "${connected.businessName}" (${connected._id}) - password matches`);
      } else {
        console.log(`  SKIP "${connected.businessName}" (${connected._id}) - different owner email`);
        skipped++;
      }
    }
  }

  console.log(`\n=== Done: ${repaired} repaired, ${skipped} skipped ===`);

  await mongoose.disconnect();
  process.exit(0);
}

repairPasswords().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});
