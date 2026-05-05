/* eslint-disable no-console */
const mongoose = require("mongoose");
const crypto = require("crypto");

const Business = require("../models/businessRegistration");
const BusinessKyc = require("../models/businessKycModel");
const Product = require("../models/productModel");
const Buyer = require("../models/buyerModel");
const BuyerWallet = require("../models/buyerWalletModel");
const BusinessWallet = require("../models/businessWalletModel");
const InternalMarketplaceOrder = require("../models/internalMarketplaceOrderModel");
const EscrowEntry = require("../models/escrowEntryModel");
const InventoryHold = require("../models/inventoryHoldModel");

const E2E_TAG = "[e2e-marketplace]";
const NOW = new Date();

const BUSINESS_FIXTURES = [
  {
    key: "admin",
    businessName: "E2E Admin HQ",
    businessEmail: "e2e.marketplace.admin@sellsquare.test",
    ownerFirstName: "Admin",
    ownerLastName: "Owner",
    industry: "Operations",
    kycStatus: "approved",
    hasStoreToken: true,
  },
  {
    key: "approvedA",
    businessName: "E2E Approved Store A",
    businessEmail: "e2e.marketplace.approved.a@sellsquare.test",
    ownerFirstName: "Ada",
    ownerLastName: "Akin",
    industry: "Electronics",
    kycStatus: "approved",
    hasStoreToken: true,
  },
  {
    key: "approvedB",
    businessName: "E2E Approved Store B",
    businessEmail: "e2e.marketplace.approved.b@sellsquare.test",
    ownerFirstName: "Bola",
    ownerLastName: "Biyi",
    industry: "Fashion",
    kycStatus: "approved",
    hasStoreToken: true,
  },
  {
    key: "submitted",
    businessName: "E2E Submitted Store",
    businessEmail: "e2e.marketplace.submitted@sellsquare.test",
    ownerFirstName: "Seyi",
    ownerLastName: "Submit",
    industry: "Groceries",
    kycStatus: "submitted",
    hasStoreToken: false,
  },
  {
    key: "rejected",
    businessName: "E2E Rejected Store",
    businessEmail: "e2e.marketplace.rejected@sellsquare.test",
    ownerFirstName: "Rita",
    ownerLastName: "Reject",
    industry: "Home",
    kycStatus: "rejected",
    rejectionReason: "Business registration document is unclear. Please resubmit a clearer scan.",
    hasStoreToken: false,
  },
  {
    key: "approvedLoadTest",
    businessName: "E2E Approved Load Test Store",
    businessEmail: "e2e.marketplace.approved.loadtest@sellsquare.test",
    ownerFirstName: "Lola",
    ownerLastName: "LoadTest",
    industry: "General",
    kycStatus: "approved",
    hasStoreToken: true,
  },
];

const BUYER_FIXTURES = [
  {
    key: "buyerA",
    firstName: "Mina",
    lastName: "Buyer",
    email: "e2e.marketplace.buyer.a@sellsquare.test",
  },
  {
    key: "buyerB",
    firstName: "Kola",
    lastName: "Buyer",
    email: "e2e.marketplace.buyer.b@sellsquare.test",
  },
];

function makeStoreToken(seedKey) {
  return crypto.createHash("sha256").update(`store-token-${seedKey}`).digest("hex").slice(0, 32);
}

async function ensureConnected() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not set. Export MONGO_URI before running this seed.");
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
}

async function purgeOldE2EData() {
  const businessEmails = BUSINESS_FIXTURES.map((b) => b.businessEmail);
  const buyerEmails = BUYER_FIXTURES.map((b) => b.email);

  const businesses = await Business.find(
    { businessEmail: { $in: businessEmails } },
    { _id: 1 },
  ).lean();
  const buyers = await Buyer.find(
    { email: { $in: buyerEmails } },
    { _id: 1 },
  ).lean();

  const businessIds = businesses.map((b) => b._id);
  const buyerIds = buyers.map((b) => b._id);

  const orderIds = await InternalMarketplaceOrder.find(
    {
      $or: [
        { business: { $in: businessIds } },
        { buyer: { $in: buyerIds } },
      ],
    },
    { _id: 1 },
  ).lean();

  const internalOrderIds = orderIds.map((o) => o._id);

  await Promise.all([
    EscrowEntry.deleteMany({
      $or: [
        { order: { $in: internalOrderIds } },
        { business: { $in: businessIds } },
        { buyer: { $in: buyerIds } },
      ],
    }),
    InventoryHold.deleteMany({
      $or: [
        { business: { $in: businessIds } },
        { buyerSession: E2E_TAG },
      ],
    }),
    InternalMarketplaceOrder.deleteMany({
      $or: [
        { _id: { $in: internalOrderIds } },
        { business: { $in: businessIds } },
        { buyer: { $in: buyerIds } },
      ],
    }),
    Product.deleteMany({ business: { $in: businessIds } }),
    BusinessKyc.deleteMany({ business: { $in: businessIds } }),
    BusinessWallet.deleteMany({ business: { $in: businessIds } }),
    BuyerWallet.deleteMany({ buyer: { $in: buyerIds } }),
    Buyer.deleteMany({ _id: { $in: buyerIds } }),
    Business.deleteMany({ _id: { $in: businessIds } }),
  ]);
}

async function seedBusinessesAndKyc() {
  const map = {};
  for (const fixture of BUSINESS_FIXTURES) {
    const business = await Business.create({
      businessName: fixture.businessName,
      businessEmail: fixture.businessEmail,
      businessAddress: `${fixture.businessName} Avenue, Lagos`,
      businessPhone: "08000000000",
      industry: fixture.industry,
      country: "Nigeria",
      photo: "https://i.ibb.co/4pDNDk1/avatar.png",
      businessOwner: {
        firstName: fixture.ownerFirstName,
        lastName: fixture.ownerLastName,
        email: fixture.businessEmail,
        password: "Passw0rd!",
      },
    });

    const kycPayload = {
      business: business._id,
      status: fixture.kycStatus,
      submittedAt: new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000),
      ownerFullName: `${fixture.ownerFirstName} ${fixture.ownerLastName}`,
      ownerNationalIdNumber: `NIN-${fixture.key.toUpperCase()}-001`,
      ownerIdDocumentUrl: `https://docs.sellsquare.test/kyc/${fixture.key}/owner-id.png`,
      businessRegNumber: `RC-${fixture.key.toUpperCase()}-2026`,
      businessRegDocumentUrl: `https://docs.sellsquare.test/kyc/${fixture.key}/business-reg.pdf`,
      businessAddress: {
        street: `${fixture.businessName} Street`,
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
      },
      bankAccountName: `${fixture.businessName} LTD`,
      bankAccountNumber: "0123456789",
      bankName: "Access Bank",
    };

    if (fixture.kycStatus === "approved") {
      kycPayload.reviewedAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
      kycPayload.reviewedBy = "e2e-admin@sellsquare.test";
      kycPayload.approvedAt = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);
      if (fixture.hasStoreToken) {
        kycPayload.storeToken = makeStoreToken(fixture.key);
        kycPayload.storeLinkGeneratedAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    if (fixture.kycStatus === "rejected") {
      kycPayload.reviewedAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
      kycPayload.reviewedBy = "e2e-admin@sellsquare.test";
      kycPayload.rejectionReason = fixture.rejectionReason;
      kycPayload.resubmissionCount = 1;
    }

    const kyc = await BusinessKyc.create(kycPayload);
    map[fixture.key] = { business, kyc };
  }
  return map;
}

async function seedProducts(businessMap) {
  const approvedAId = businessMap.approvedA.business._id;
  const approvedBId = businessMap.approvedB.business._id;
  const approvedLoadTestId = businessMap.approvedLoadTest.business._id;
  const submittedId = businessMap.submitted.business._id;
  const rejectedId = businessMap.rejected.business._id;

  const products = await Product.insertMany([
    {
      business: approvedAId,
      name: "E2E Wireless Headphones",
      sku: "E2E-A-001",
      category: "Electronics",
      quantity: 40,
      activeMarketplaceHoldQty: 6,
      price: 25000,
      description: `${E2E_TAG} Electronics item with active holds`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-headphones.jpg" },
      images: [{ url: "https://cdn.sellsquare.test/products/e2e-headphones.jpg" }],
    },
    {
      business: approvedAId,
      name: "E2E Bluetooth Speaker",
      sku: "E2E-A-002",
      category: "Electronics",
      quantity: 25,
      activeMarketplaceHoldQty: 0,
      price: 18000,
      description: `${E2E_TAG} Secondary listed item`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-speaker.jpg" },
    },
    {
      business: approvedBId,
      name: "E2E Casual Sneakers",
      sku: "E2E-B-001",
      category: "Fashion",
      quantity: 30,
      activeMarketplaceHoldQty: 3,
      price: 32000,
      description: `${E2E_TAG} Fashion item used in split checkout`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-sneakers.jpg" },
    },
    {
      business: approvedBId,
      name: "E2E Denim Jacket",
      sku: "E2E-B-002",
      category: "Fashion",
      quantity: 0,
      activeMarketplaceHoldQty: 0,
      price: 27000,
      description: `${E2E_TAG} Out-of-stock listing still visible`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-jacket.jpg" },
    },
    {
      business: approvedBId,
      name: "E2E Hidden Internal Product",
      sku: "E2E-B-003",
      category: "Fashion",
      quantity: 10,
      activeMarketplaceHoldQty: 0,
      price: 10000,
      description: `${E2E_TAG} Not listed product`,
      listProduct: false,
      image: { url: "https://cdn.sellsquare.test/products/e2e-hidden.jpg" },
    },
    {
      business: submittedId,
      name: "E2E Submitted Biz Product",
      sku: "E2E-S-001",
      category: "Groceries",
      quantity: 20,
      activeMarketplaceHoldQty: 0,
      price: 5000,
      description: `${E2E_TAG} Should be excluded from public listings`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-submitted.jpg" },
    },
    {
      business: rejectedId,
      name: "E2E Rejected Biz Product",
      sku: "E2E-R-001",
      category: "Home",
      quantity: 12,
      activeMarketplaceHoldQty: 0,
      price: 9000,
      description: `${E2E_TAG} Should be excluded from public listings`,
      listProduct: true,
      image: { url: "https://cdn.sellsquare.test/products/e2e-rejected.jpg" },
    },
  ]);

  const bySku = {};
  for (const product of products) bySku[product.sku] = product;

  // Add 100+ products for the load test business
  const categories = [
    "Electronics", "Fashion", "Groceries", "Home", "Toys", "Books", "Sports", "Beauty", "Automotive", "Garden"
  ];
  const loadTestProducts = [];
  for (let i = 1; i <= 120; i++) {
    const cat = categories[i % categories.length];
    loadTestProducts.push({
      business: approvedLoadTestId,
      name: `E2E LoadTest Product ${i}`,
      sku: `E2E-LT-${i.toString().padStart(3, '0')}`,
      category: cat,
      quantity: 50 + (i % 50),
      activeMarketplaceHoldQty: 0,
      price: 1000 + (i * 10),
      description: `${E2E_TAG} Load test product #${i} in ${cat}`,
      listProduct: true,
      image: { url: `https://cdn.sellsquare.test/products/e2e-loadtest-${i}.jpg` },
    });
  }
  const loadTestProductDocs = await Product.insertMany(loadTestProducts);
  for (const p of loadTestProductDocs) bySku[p.sku] = p;

  return bySku;
}

async function seedBuyersAndWallets() {
  const buyerMap = {};
  for (const fixture of BUYER_FIXTURES) {
    const buyer = await Buyer.create({
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      email: fixture.email,
      password: "BuyerPass123!",
      isEmailVerified: true,
      defaultShippingAddress: {
        street: "12 Buyer Street",
        city: "Lagos",
        state: "Lagos",
      },
    });
    buyerMap[fixture.key] = buyer;
  }

  const buyerA = buyerMap.buyerA;
  const buyerB = buyerMap.buyerB;

  await BuyerWallet.insertMany([
    {
      buyer: buyerA._id,
      balance: 45000,
      currency: "NGN",
      transactions: [
        {
          type: "credit",
          amount: 30000,
          reason: "Initial test funding",
          reference: "E2E-BW-INIT-001",
          createdAt: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          type: "credit",
          amount: 15000,
          reason: "Refund from rejected order",
          reference: "E2E-BW-RFND-001",
          createdAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
        },
      ],
    },
    {
      buyer: buyerB._id,
      balance: 10000,
      currency: "NGN",
      transactions: [
        {
          type: "credit",
          amount: 10000,
          reason: "Initial test funding",
          reference: "E2E-BW-INIT-002",
          createdAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
      ],
    },
  ]);

  return buyerMap;
}

async function seedOrdersEscrowAndWallets({ businessMap, buyerMap, productMap }) {
  const checkoutSessionRef = `E2E-CHK-${Date.now()}`;
  const buyerA = buyerMap.buyerA;
  const approvedAId = businessMap.approvedA.business._id;
  const approvedBId = businessMap.approvedB.business._id;

  const orderA = await InternalMarketplaceOrder.create({
    business: approvedAId,
    buyer: buyerA._id,
    checkoutSessionRef,
    status: "accepted",
    shippingAddress: "12 Buyer Street, Lagos",
    subtotal: 50000,
    lines: [
      {
        product: productMap["E2E-A-001"]._id,
        sku: "E2E-A-001",
        name: "E2E Wireless Headphones",
        requestedQty: 2,
        acceptedQty: 2,
        rejectedQty: 0,
        lineStatus: "accepted",
        unitPrice: 25000,
        lineTotal: 50000,
      },
    ],
    statusHistory: [
      { from: "payment_confirmed", to: "accepted", by: "business", at: NOW },
    ],
  });

  const orderB = await InternalMarketplaceOrder.create({
    business: approvedBId,
    buyer: buyerA._id,
    checkoutSessionRef,
    status: "rejected",
    rejectionReason: "Insufficient size variant in stock",
    shippingAddress: "12 Buyer Street, Lagos",
    subtotal: 32000,
    lines: [
      {
        product: productMap["E2E-B-001"]._id,
        sku: "E2E-B-001",
        name: "E2E Casual Sneakers",
        requestedQty: 1,
        acceptedQty: 0,
        rejectedQty: 1,
        lineStatus: "rejected",
        decisionReason: "Size unavailable",
        unitPrice: 32000,
        lineTotal: 32000,
      },
    ],
    statusHistory: [
      { from: "payment_confirmed", to: "rejected", by: "business", reason: "Size unavailable", at: NOW },
    ],
  });

  const pendingOrder = await InternalMarketplaceOrder.create({
    business: approvedBId,
    buyer: buyerMap.buyerB._id,
    checkoutSessionRef: `E2E-CHK-PENDING-${Date.now()}`,
    status: "payment_confirmed",
    shippingAddress: "45 Buyer Avenue, Abuja",
    subtotal: 18000,
    lines: [
      {
        product: productMap["E2E-B-002"]._id,
        sku: "E2E-B-002",
        name: "E2E Denim Jacket",
        requestedQty: 1,
        unitPrice: 18000,
        lineTotal: 18000,
      },
    ],
  });

  const escrowA = await EscrowEntry.create({
    buyer: buyerA._id,
    business: approvedAId,
    order: orderA._id,
    checkoutSessionRef,
    amount: 50000,
    status: "released_to_business",
    paymentReference: "E2E-PAY-ACCEPTED-001",
    paidAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    settledAt: NOW,
  });

  const escrowB = await EscrowEntry.create({
    buyer: buyerA._id,
    business: approvedBId,
    order: orderB._id,
    checkoutSessionRef,
    amount: 32000,
    status: "refunded_to_buyer",
    paymentReference: "E2E-PAY-REJECTED-001",
    paidAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    settledAt: NOW,
  });

  const escrowPending = await EscrowEntry.create({
    buyer: buyerMap.buyerB._id,
    business: approvedBId,
    order: pendingOrder._id,
    checkoutSessionRef: pendingOrder.checkoutSessionRef,
    amount: 18000,
    status: "held",
    paymentReference: "E2E-PAY-HELD-001",
    paidAt: NOW,
  });

  orderA.escrowEntryId = escrowA._id;
  orderB.escrowEntryId = escrowB._id;
  pendingOrder.escrowEntryId = escrowPending._id;
  await Promise.all([orderA.save(), orderB.save(), pendingOrder.save()]);

  await BusinessWallet.insertMany([
    {
      business: approvedAId,
      balance: 50000,
      currency: "NGN",
      transactions: [
        {
          type: "credit",
          amount: 50000,
          reason: "Escrow release for accepted internal marketplace order",
          reference: "E2E-BIZW-CREDIT-001",
          relatedOrder: orderA._id,
          createdAt: NOW,
        },
      ],
    },
    {
      business: approvedBId,
      balance: 0,
      currency: "NGN",
      transactions: [
        {
          type: "debit",
          amount: 0,
          reason: "No release due to rejected order",
          reference: "E2E-BIZW-NOOP-001",
          relatedOrder: orderB._id,
          createdAt: NOW,
        },
      ],
    },
  ]);
}

async function seedInventoryHolds({ businessMap, buyerMap, productMap }) {
  const approvedAId = businessMap.approvedA.business._id;
  const approvedBId = businessMap.approvedB.business._id;

  const pseudoOrderIdA = new mongoose.Types.ObjectId();
  const pseudoOrderIdB = new mongoose.Types.ObjectId();

  await InventoryHold.insertMany([
    {
      business: approvedAId,
      order: pseudoOrderIdA,
      lineId: "E2E-LINE-ACTIVE-1",
      product: productMap["E2E-A-001"]._id,
      quantity: 2,
      source: "buyer_cart",
      status: "active",
      expiresAt: new Date(Date.now() + 4 * 60 * 1000),
      buyerSession: E2E_TAG,
    },
    {
      business: approvedBId,
      order: pseudoOrderIdB,
      lineId: "E2E-LINE-EXPIRED-1",
      product: productMap["E2E-B-001"]._id,
      quantity: 1,
      source: "buyer_cart",
      status: "expired",
      releaseReason: "hold_timeout",
      releasedAt: new Date(Date.now() - 2 * 60 * 1000),
      expiresAt: new Date(Date.now() - 7 * 60 * 1000),
      buyerSession: E2E_TAG,
    },
    {
      business: approvedAId,
      order: pseudoOrderIdA,
      lineId: "E2E-LINE-CONSUMED-1",
      product: productMap["E2E-A-002"]._id,
      quantity: 1,
      source: "buyer_cart",
      status: "consumed",
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
      buyerSession: E2E_TAG,
    },
  ]);
}

async function seedInternalMarketplaceE2E() {
  await ensureConnected();
  console.log(`${E2E_TAG} connected`);

  await purgeOldE2EData();
  console.log(`${E2E_TAG} old fixture data purged`);

  const businessMap = await seedBusinessesAndKyc();
  const productMap = await seedProducts(businessMap);
  const buyerMap = await seedBuyersAndWallets();
  await seedOrdersEscrowAndWallets({ businessMap, buyerMap, productMap });
  await seedInventoryHolds({ businessMap, buyerMap, productMap });

  const approvedStoreAToken = businessMap.approvedA.kyc.storeToken;
  const approvedStoreBToken = businessMap.approvedB.kyc.storeToken;
  const approvedLoadTestToken = businessMap.approvedLoadTest.kyc.storeToken;

  const summary = {
    businesses: Object.keys(businessMap).length,
    buyers: Object.keys(buyerMap).length,
    listedProducts: 5 + 120, // 5 main + 120 load test
    checkoutScenarios: [
      "accepted_order_with_escrow_release",
      "rejected_order_with_buyer_refund",
      "payment_confirmed_pending_decision",
      "load_test_large_volume_products"
    ],
    storeLinks: [
      `/marketplace/store/${approvedStoreAToken}`,
      `/marketplace/store/${approvedStoreBToken}`,
      `/marketplace/store/${approvedLoadTestToken}`,
    ],
    buyerLogins: BUYER_FIXTURES.map((b) => ({
      email: b.email,
      password: "BuyerPass123!",
    })),
    businessLogins: BUSINESS_FIXTURES.map((b) => ({
      email: b.businessEmail,
      password: "Passw0rd!",
      kycStatus: b.kycStatus,
    })),
    loadTest: {
      business: {
        email: "e2e.marketplace.approved.loadtest@sellsquare.test",
        password: "Passw0rd!",
        storeLink: `/marketplace/store/${approvedLoadTestToken}`,
        productCount: 120,
        categories: [
          "Electronics", "Fashion", "Groceries", "Home", "Toys", "Books", "Sports", "Beauty", "Automotive", "Garden"
        ]
      }
    }
  };

  console.log(`${E2E_TAG} seed completed`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  seedInternalMarketplaceE2E()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(`${E2E_TAG} seed failed`, error);
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        // ignore disconnect error
      }
      process.exit(1);
    });
}

module.exports = seedInternalMarketplaceE2E;
