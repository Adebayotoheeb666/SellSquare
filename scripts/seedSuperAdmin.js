/**
 * Seeds the super admin account with the required ID into the local MongoDB.
 * Run once: node scripts/seedSuperAdmin.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SUPER_ADMIN_ID = "69f869e522a7677061145572";
const ADMIN_EMAIL = "adminuser@gmail.com";
const ADMIN_PASSWORD = "Admin@1234"; // Change after first login

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB:", process.env.MONGO_URI);

  const BusinessRegistration = require("../models/businessRegistration");

  // Check if already exists
  const existing = await BusinessRegistration.findById(SUPER_ADMIN_ID);
  if (existing) {
    console.log("✅ Super admin account already exists:");
    console.log("  - ID:    ", existing._id.toString());
    console.log("  - Name:  ", existing.businessName);
    console.log("  - Email: ", existing.businessEmail);
    await mongoose.disconnect();
    return;
  }

  // Hash the password manually since we're using insertOne (bypasses pre-save hook)
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // Use insertOne to force the specific _id
  const collection = mongoose.connection.collection("businessregistrations");
  await collection.insertOne({
    _id: new mongoose.Types.ObjectId(SUPER_ADMIN_ID),
    businessName: "SellSquare Admin",
    businessEmail: ADMIN_EMAIL,
    businessAddress: "1 Admin Street, Lagos",
    businessPhone: "08000000000",
    industry: "Platform Operations",
    country: "Nigeria",
    photo: "https://i.ibb.co/4pDNDk1/avatar.png",
    businessOwner: {
      firstName: "Super",
      lastName: "Admin",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      permissions: {
        addProducts: true,
        deleteProducts: true,
        editproducts: true,
        returnItems: true,
        sellProducts: true,
        grantPermissions: true,
        seeBusinessFinances: true,
      },
    },
    salesRep: [],
    subscription: {
      isSubscribed: true,
      subscriptionType: "recurring",
      plan: "Professional",
      businessActivities: true,
      nextDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    connectedStores: [],
    verified: { sendgrid: false },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("✅ Super admin account created successfully!");
  console.log("  - ID:      ", SUPER_ADMIN_ID);
  console.log("  - Email:   ", ADMIN_EMAIL);
  console.log("  - Password:", ADMIN_PASSWORD, "(please change after first login)");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
