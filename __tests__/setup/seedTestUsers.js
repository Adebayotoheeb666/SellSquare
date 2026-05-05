// Seeds required business and admin users for KYC flow integration tests
const mongoose = require('mongoose');
const Business = require('../../models/businessRegistration');
const { ADMIN_BUSINESS_IDS } = require('../../utils/adminAccess');

const TEST_BUSINESS = {
  businessName: 'Test Business',
  businessEmail: 'test-business@example.com',
  businessOwner: {
    firstName: 'Test',
    lastName: 'Business',
    email: 'test-business@example.com',
    password: 'TestBusiness123!',
  },
  photo: 'https://i.ibb.co/4pDNDk1/avatar.png',
};

const TEST_ADMIN = {
  _id: ADMIN_BUSINESS_IDS[0],
  businessName: 'Test Admin Business',
  businessEmail: 'test-admin@example.com',
  businessOwner: {
    firstName: 'Test',
    lastName: 'Admin',
    email: 'test-admin@example.com',
    password: 'TestAdmin123!',
  },
  photo: 'https://i.ibb.co/4pDNDk1/avatar.png',
};

async function seedTestUsers() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI not set');
  }
  await mongoose.connect(process.env.MONGO_URI);

  // Upsert business user
  await Business.findOneAndUpdate(
    { businessEmail: TEST_BUSINESS.businessEmail },
    { $set: TEST_BUSINESS },
    { upsert: true, new: true }
  );

  // Upsert admin user (business with admin ID)
  await Business.findOneAndUpdate(
    { _id: TEST_ADMIN._id },
    { $set: TEST_ADMIN },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await mongoose.disconnect();
  console.log('Seeded test business and admin users.');
}

if (require.main === module) {
  seedTestUsers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = seedTestUsers;
