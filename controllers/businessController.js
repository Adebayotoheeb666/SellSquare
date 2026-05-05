const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const BusinessRegistration = require("../models/businessRegistration");
const Email = require("../models/emailModel");
const RegistrationFollowup = require("../models/registrationFollowupModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const { sendEmailWithAttachment, sendEmail } = require("../utils/sendEmail");
const cloudinary = require("cloudinary").v2;
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const CheckOut = require("../models/checkOutSalesModel");
const authenticateSender = require("../utils/authenticateSender");
const getSendersList = require("../utils/getSendersList");
const { getFileStream } = require("../utils/s3bucket");
const { createReceipt } = require("../utils/fileDownload");
const Activities = require("../models/Activities");
const logActivity = require("../middleWare/logActivityMiddleware");
const { manualCleanupOldActivities } = require("../utils/cronJobs");
const cron = require("node-cron");
const userFormatter = require("../utils/formatter");
const MonthlyReport = require("../models/MonthlyReport");
const moment = require("moment");
const { hasAdminBusinessAccess } = require("../utils/adminAccess");

const ADMIN_COMMUNICATION_DEFAULTS = {
  accountHealth: {
    subject: "Action required on your SellSquare account",
    message:
      "Hello {{businessName}},\n\nWe noticed there are account updates that need your attention. Please review your store settings and reach out if you need support.\n\nRegards,\nSellSquare Admin",
  },
  subscriptionReminder: {
    subject: "Subscription reminder for {{businessName}}",
    message:
      "Hello {{ownerName}},\n\nThis is a reminder that your current plan is {{plan}} and your due date is {{dueDate}}. Please renew before the due date to avoid service interruptions.\n\nRegards,\nSellSquare Admin",
  },
  policyUpdate: {
    subject: "Important policy update from SellSquare",
    message:
      "Hello {{businessName}},\n\nWe have published an important policy update that affects store operations on the platform. Please review the updated guidance and contact us for clarification if needed.\n\nRegards,\nSellSquare Admin",
  },
  performanceNudge: {
    subject: "Performance suggestions for {{businessName}}",
    message:
      "Hello {{ownerName}},\n\nWe reviewed your store activity and prepared recommendations that may improve your sales and catalog health. Reply to this email if you want a tailored optimization review.\n\nRegards,\nSellSquare",
  },
  newAccountWelcome: {
    subject: "Welcome to SellSquare, {{businessName}}",
    message:
      "Hello {{ownerName}},\n\nWelcome to SellSquare. Your business account has been successfully created and is now active.\n\nRecommended next steps:\n1. Complete your business profile details\n2. Add your first products\n3. Invite your sales team\n\nIf you need help, reply to this email and our team will assist you.\n\nRegards,\nSellSquare",
  },
  custom: {
    subject: "Message from SellSquare",
    message:
      "Hello {{businessName}},\n\nWe wanted to share an update regarding your account.\n\nRegards,\nSellSquare",
  },
};

const interpolateAdminMessage = (template, variables) => {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return variables[key] != null ? String(variables[key]) : "";
  });
};

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Calculate milliseconds until next Monday midnight
const getMillisecondsUntilNextMonday = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMillisecond = now.getMilliseconds();

  // If it's Monday before midnight, expire at next Monday
  // Otherwise, calculate days until next Monday
  let daysUntilMonday;
  if (currentDay === 1 && currentHour === 0 && currentMinute === 0) {
    // It's exactly Monday midnight, expire in 7 days
    daysUntilMonday = 7;
  } else if (currentDay === 0) {
    // Sunday - next Monday is 1 day away
    daysUntilMonday = 1;
  } else if (currentDay === 1) {
    // Monday - next Monday is 7 days away
    daysUntilMonday = 7;
  } else {
    // Tuesday through Saturday
    daysUntilMonday = (8 - currentDay) % 7;
  }

  // Calculate milliseconds until next Monday at midnight
  const millisecondsInDay = 24 * 60 * 60 * 1000;
  const millisecondsToday =
    currentHour * 60 * 60 * 1000 +
    currentMinute * 60 * 1000 +
    currentSecond * 1000 +
    currentMillisecond;
  const millisecondsUntilMonday =
    daysUntilMonday * millisecondsInDay - millisecondsToday;

  return millisecondsUntilMonday;
};

// Generate Token with Monday-to-Monday expiration
const generateToken = (id, claims = {}) => {
  const millisecondsUntilMonday = getMillisecondsUntilNextMonday();
  const secondsUntilMonday = Math.floor(millisecondsUntilMonday / 1000);
  return jwt.sign({ id, ...claims }, process.env.JWT_SECRET, {
    expiresIn: secondsUntilMonday,
  });
};

const sendMonthlyReportsToAllBusinesses = async () => {
  try {
    const businesses = await BusinessRegistration.find();

    for (const business of businesses) {
      if (
        business.subscription.plan === "Free" ||
        business.subscription.plan === "Basic"
      ) {
        continue;
      }

      const businessId = business._id;
      const businessOwnerEmail = business.businessOwner.email;
      const { formatter } = userFormatter(business.country);

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const previousMonth = new Date().getMonth();

      const targetYear = previousMonth === 0 ? currentYear - 1 : currentYear;
      const targetMonth = previousMonth === 0 ? 12 : previousMonth;
      const formattedDate = moment(
        `${targetYear}-${targetMonth}`,
        "YYYY-M",
      ).format("MMMM, YYYY");

      const pipeline = [
        { $unwind: "$items" },
        {
          $project: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            quantity: {
              $convert: {
                input: "$items.quantity",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
            cost: {
              $convert: {
                input: "$items.cost",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
            price: {
              $convert: {
                input: "$items.price",
                to: "double",
                onError: null,
                onNull: null,
              },
            },
            business: "$business",
          },
        },
        {
          $match: {
            quantity: { $ne: null },
            cost: { $ne: null },
            price: { $ne: null },
            business: mongoose.Types.ObjectId(business._id),
            year: targetYear,
            month: targetMonth,
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            totalSales: { $sum: { $multiply: ["$quantity", "$price"] } },
            totalProfit: {
              $sum: {
                $subtract: [
                  { $multiply: ["$quantity", "$price"] },
                  { $multiply: ["$quantity", "$cost"] },
                ],
              },
            },
          },
        },
        { $sort: { "_id.month": 1 } },
      ];

      const salesData = await CheckOut.aggregate(pipeline, (err, result) => {
        if (err) {
          // res.status(400).json({ err });
          throw new Error(err);
        } else {
          return { data: result };
        }
      });

      const totalSales = salesData[0]?.totalSales || 0;
      const totalProfit = salesData[0]?.totalProfit || 0;

      // Get remaining stock and stock worth
      const stockData = await Product.aggregate([
        { $match: { business: businessId } },
        {
          $group: {
            _id: null,
            remainingStock: { $sum: 1 }, // Count total number of distinct products
            stockWorthCost: {
              $sum: {
                $multiply: [
                  {
                    $convert: {
                      input: "$cost",
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                  {
                    $convert: {
                      input: "$quantity",
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                ],
              },
            },
            stockWorthPrice: {
              $sum: {
                $multiply: [
                  {
                    $convert: {
                      input: "$price",
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                  {
                    $convert: {
                      input: "$quantity",
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                ],
              },
            },
          },
        },
      ]);

      const pendingPaymentsData = await CheckOut.aggregate([
        { $match: { business: mongoose.Types.ObjectId(business._id) } },
        { $unwind: "$payment.paymentParts" },
        { $match: { "payment.paymentType": "part" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalPendingAmount: { $sum: "$payment.paymentDetails.balance" },
          },
        },
      ]);

      const topSellingProductData = await CheckOut.aggregate([
        { $unwind: "$items" },
        {
          $project: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            quantity: {
              $convert: {
                input: "$items.quantity",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            cost: {
              $convert: {
                input: "$items.cost",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            price: {
              $convert: {
                input: "$items.price",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
            product: "$items.name",
            productId: "$items.id",
            business: "$business",
          },
        },
        {
          $match: {
            business: mongoose.Types.ObjectId(business._id),
            year: targetYear, // Filter by the selected year
            month: targetMonth, // Filter by the selected month
          },
        },
        {
          $group: {
            _id: "$productId",
            name: { $first: "$product" },
            totalQuantity: { $sum: "$quantity" },
            totalProfit: {
              $sum: {
                $subtract: [
                  { $multiply: ["$quantity", "$price"] },
                  { $multiply: ["$quantity", "$cost"] },
                ],
              },
            },
          },
        },
        { $sort: { totalQuantity: -1 } }, // Sort by highest quantity sold
        { $limit: 1 }, // Get the top-selling product
      ]);

      const topSellingProduct = topSellingProductData[0] || {
        name: "N/A",
        totalQuantity: 0,
        totalProfit: 0,
      };

      const pendingPaymentsCount = pendingPaymentsData[0]?.count || 0;
      const pendingPaymentsAmount =
        pendingPaymentsData[0]?.totalPendingAmount || 0;

      const remainingStock = stockData[0]?.remainingStock || 0;
      const stockWorthCost = stockData[0]?.stockWorthCost || 0;
      const stockWorthPrice = stockData[0]?.stockWorthPrice || 0;

      // Get top-selling and low-stock products
      const topSellingProducts = await CheckOut.aggregate([
        { $unwind: "$items" },
        { $match: { business: mongoose.Types.ObjectId(business) } },
        {
          $group: {
            _id: "$items.product",
            total_sales: {
              $sum: {
                $convert: {
                  input: "$items.quantity",
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
        { $sort: { total_sales: -1 } }, // Sort by highest sales
        { $limit: 5 }, // Get top 5 products
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product_details",
          },
        },
        { $unwind: "$product_details" },
        {
          $project: {
            name: "$product_details.name",
            total_sales: 1,
          },
        },
      ]);

      const monthlyReport = await MonthlyReport.create({
        business: businessId,
        month: previousMonth, // currentMonth, previousMonth,
        year: currentYear,
        totalSales,
        netProfit: totalProfit,
        stockWorthPrice,
        stockWorthCost,
        pendingPayments: {
          count: pendingPaymentsCount,
          amount: pendingPaymentsAmount,
        },
        newCustomers: 0,
      });

      const previousMonthlyReport = await MonthlyReport.findOne({
        business: businessId,
        month: targetMonth - 1,
        year: targetYear,
      });

      let percentageIncrease = {
        totalSales: 0,
        netProfit: 0,
        stockWorthCost: 0,
        stockWorthPrice: 0,
      };
      let pendingPaymentsIncrease = 0;
      let newCustomersIncrease = 0;

      if (previousMonthlyReport) {
        const previousTotalSales = previousMonthlyReport.totalSales || 1;
        const previousNetProfit = previousMonthlyReport.netProfit || 1;
        const previousStockWorthPrice =
          previousMonthlyReport.stockWorthPrice || 1;
        const previousStockWorthCost =
          previousMonthlyReport.stockWorthCost || 1;

        const previousPendingPayments =
          previousMonthlyReport?.pendingPayments?.amount || 1;
        const previousNewCustomers = previousMonthlyReport?.newCustomers || 1;

        pendingPaymentsIncrease =
          ((pendingPaymentsAmount - previousPendingPayments) /
            previousPendingPayments) *
          100;
        newCustomersIncrease =
          ((0 - previousNewCustomers) / previousNewCustomers) * 100;

        percentageIncrease = {
          totalSales:
            ((totalSales - previousTotalSales) / previousTotalSales) * 100,
          netProfit:
            ((totalProfit - previousNetProfit) / previousNetProfit) * 100,
          stockWorthPrice:
            ((stockWorthPrice - previousStockWorthPrice) /
              previousStockWorthPrice) *
            100,
          stockWorthCost:
            ((stockWorthCost - previousStockWorthCost) /
              previousStockWorthCost) *
            100,
        };
      }

      const logoURL =
        "https://res.cloudinary.com/dfrwntkjm/image/upload/v1743483597/White_background_wsidzo.png"; // Replace with actual logo URL

      const salesImprovementText =
        percentageIncrease.totalSales > 0
          ? "Great! You improved your sales this month."
          : "Keep pushing! There's room for improvement.";

      const message = `
        <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Activity Report</title>
            <style>
              body {
                font-family: 'Poppins', sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
              }

              * {
                box-sizing: border-box;
              }

              .container {
                max-width: 600px;
                width: 100%;
                margin: auto;
                border: 1px solid #ddd;
                padding: 20px;
                border-radius: 10px;
                background-color: #fff;
              }
              .logo {
                text-align: center;
                margin-bottom: 10px;
              }
              .logo img {
                width: 100%;
                object-fit: cover;
                height: 75px;
                border-radius: 8px; 
              }
              h2 {
                color: #295F2D;
                text-align: center;
              }
              p {
                color: #555;
                text-align: center;
              }
              .table-container {
                width: 100%;
                word-wrap: break-word;
              }
              .spaced-row {
                margin-bottom: 10px;
              }
              .spaced-row table {
                width: 100%;
                table-layout: fixed;
              }
              td {
                background: #f7f7f7;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
              }
              .highlight {
                background: #e3f4e3;
                border: 2px solid #295F2D;
              }
              .summary-text {
                color: green;
                font-weight: bold;
                text-align: center;
              }
              .footer {
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <img src="${logoURL}" alt="Sell Square Logo">
              </div>
              <h2>${formattedDate} Activity Report for ${
                business.businessName
              }</h2>
              <p>Here is a summary of your business activities for ${formattedDate}:</p>

              <div class="table-container">
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Total Sales</p>
                        <p style="font-size: 24px; font-weight: bold;">${formatter(
                          totalSales,
                        )}</p>
                        <p style="font-size: 12px; color: ${
                          percentageIncrease.totalSales > 0 ? "green" : "red"
                        };">
                          ${percentageIncrease.totalSales.toFixed(2)}% ${
                            percentageIncrease.totalSales > 0
                              ? "increase"
                              : "decrease"
                          } - 
                          ${
                            percentageIncrease.totalSales > 0
                              ? "Great job! Keep pushing sales."
                              : "Sales dropped from previous month, consider promotions."
                          }
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Total Profit</p>
                        <p style="font-size: 24px; font-weight: bold;">${formatter(
                          totalProfit,
                        )}</p>
                        <p style="font-size: 12px; color: ${
                          percentageIncrease.netProfit > 0 ? "green" : "red"
                        };">
                          ${percentageIncrease.netProfit.toFixed(2)}% ${
                            percentageIncrease.netProfit > 0
                              ? "increase"
                              : "decrease"
                          } - 
                          ${
                            percentageIncrease.netProfit > 0
                              ? "Your business is becoming more profitable!"
                              : "Profit margin decreased from previous month, review pricing."
                          }
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Remaining Stock</p>
                        <p style="font-size: 24px; font-weight: bold;">${remainingStock}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Stock Worth (Cost)</p>
                        <p style="font-size: 24px; font-weight: bold;">${formatter(
                          stockWorthCost,
                        )}</p>
                        <p style="font-size: 12px; color: ${
                          percentageIncrease.stockWorthCost > 0
                            ? "green"
                            : "red"
                        };">
                          ${percentageIncrease.stockWorthCost.toFixed(2)}% ${
                            percentageIncrease.stockWorthCost > 0
                              ? "increase"
                              : "decrease"
                          } - 
                          ${
                            percentageIncrease.stockWorthCost > 0
                              ? "Your inventory value is increasing."
                              : "Stock value dropped, check inventory levels. Consider restocking."
                          }
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Stock Worth (Price)</p>
                        <p style="font-size: 24px; font-weight: bold;">${formatter(
                          stockWorthPrice,
                        )}</p>
                        <p style="font-size: 12px; color: ${
                          percentageIncrease.stockWorthPrice > 0
                            ? "green"
                            : "red"
                        };">
                          ${percentageIncrease.stockWorthPrice.toFixed(2)}% ${
                            percentageIncrease.stockWorthPrice > 0
                              ? "increase"
                              : "decrease"
                          } - 
                          ${
                            percentageIncrease.stockWorthPrice > 0
                              ? "Potential revenue from stock increased."
                              : "Selling price value dropped, check pricing."
                          }
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Pending Payments</p>
                        <p style="font-size: 24px; font-weight: bold;">${formatter(
                          pendingPaymentsAmount,
                        )}</p>
                        <p style="font-size: 12px; color: ${
                          pendingPaymentsIncrease > 0 ? "red" : "green"
                        };">
                          ${pendingPaymentsIncrease.toFixed(2)}% ${
                            pendingPaymentsIncrease > 0
                              ? "increase"
                              : "decrease"
                          } - 
                          ${
                            pendingPaymentsIncrease > 0
                              ? "More pending payments, consider follow-ups."
                              : "Pending payments reduced, great job!"
                          } 
                          (${pendingPaymentsCount} transactions)
                        </p>
                      </td>
                    </tr>
                  </table>
                </div>
                <div class="spaced-row highlight">
                  <table>
                    <tr>
                      <td>
                        <p style="font-size: 16px; font-weight: 600; color: #295F2D;">Top Selling Product</p>
                        <p style="font-size: 20px; font-weight: bold;">${
                          topSellingProduct.name
                        }</p>
                        <p style="font-size: 16px;">${
                          topSellingProduct.totalQuantity
                        } sold</p>
                        <p style="font-size: 16px;">Profit: ${formatter(
                          topSellingProduct.totalProfit,
                        )}</p>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>

              <h4 class="summary-text">${salesImprovementText}</h4>

              <h4 class="footer">Regards,<br><strong>Sell Square</strong></h4>
            </div>
          </body>
          </html>
      `;

      const subject = `${formattedDate} Activity Report for ${business.businessName}`;
      const send_to = businessOwnerEmail;
      const sent_from = process.env.EMAIL_FROM;

      await sendEmail(
        subject,
        { reportHTML: message },
        send_to,
        sent_from,
        null,
        { template: "monthly-report" },
      );
    }

    console.log("Monthly reports sent to all businesses.");
  } catch (error) {
    console.error("Error sending monthly reports:", error);
  }
};

// Schedule it to run on the 1st of every month at 00:00
cron.schedule("0 0 1 * *", () => {
  console.log("Running monthly report job...");
  sendMonthlyReportsToAllBusinesses();
});

// sendMonthlyReportsToAllBusinesses();

// Register Business
const registerBusiness = asyncHandler(async (req, res) => {
  const {
    businessName,
    businessEmail,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    businessAddress,
    businessPhone,
    ownerPassword,
    industry,
    country,
    photo,
  } = req.body;

  // Validation
  if (
    !businessName ||
    !businessEmail ||
    !ownerFirstName ||
    !ownerLastName ||
    !ownerEmail ||
    !ownerPassword
  ) {
    res.status(400);
    throw new Error("Please fill in all required fields");
  }
  if (ownerPassword.length < 6) {
    res.status(400);
    throw new Error("Password must be up to 6 characters");
  }

  // Check if business email already exists
  const businessExists = await BusinessRegistration.findOne({ businessEmail });

  if (businessExists) {
    res.status(400);
    throw new Error("A business exists with this email");
  }

  // Check if owner email is already registered (unless it equals the business email)
  const normalizedOwnerEmail = ownerEmail.toLowerCase().trim();
  const normalizedBusinessEmail = businessEmail.toLowerCase().trim();
  const ownerEmailExists = await Email.findOne({ email: normalizedOwnerEmail });

  if (ownerEmailExists && normalizedOwnerEmail !== normalizedBusinessEmail) {
    res.status(400);
    throw new Error("This email is already registered to another account");
  }

  // Create new Business
  const businessRegistration = await BusinessRegistration.create({
    businessName,
    businessEmail,
    businessAddress,
    businessPhone,
    photo,
    industry,
    country,
    businessOwner: {
      firstName: ownerFirstName,
      lastName: ownerLastName,
      email: ownerEmail,
      password: ownerPassword,
    },
  });

  if (businessRegistration) {
    // Create Email record for the owner (upsert to handle owner email = business email)
    await Email.findOneAndUpdate(
      { email: normalizedOwnerEmail },
      {
        email: normalizedOwnerEmail,
        business: businessRegistration._id,
        isAdmin: true,
      },
      { upsert: true, new: true }
    );

    //   Generate Token
    const token = generateToken(businessRegistration._id);

    // Seed registration follow-up sequence — fire-and-forget, never blocks registration
    (async () => {
      try {
        const platformId = process.env.SUPERADMIN_BUSINESS_ID;
        if (!platformId) return;

        const now = new Date();
        const day = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

        await RegistrationFollowup.create({
          business: platformId,
          contactEmail: ownerEmail || businessEmail,
          contactPhone: businessPhone || null,
          contactName: `${ownerFirstName} ${ownerLastName}`.trim(),
          businessName,
          registeredAt: now,
          status: "in_sequence",
          followupSequence: [
            {
              sequenceNumber: 1,
              channel: "email",
              scheduledFor: now,
              status: "pending",
              templateContent: {
                subject: "Welcome to SellSquare, {{contactName}}!",
                body: "Hi {{contactName}},\n\nCongratulations on creating your SellSquare store for {{businessName}}!\n\nHere are your first steps:\n1. Complete your business profile\n2. Add your first products\n3. Share your store link with customers\n\nWe're here if you need any help.\n\nTeam SellSquare",
                cta: "Set up my store",
              },
            },
            {
              sequenceNumber: 2,
              channel: "email",
              scheduledFor: day(2),
              status: "pending",
              templateContent: {
                subject: "Have you added your products yet, {{contactName}}?",
                body: "Hi {{contactName}},\n\nIt's been 2 days since you joined SellSquare. Have you had a chance to add your products?\n\nBusinesses that list products within their first week get 3x more visibility. Log in now and add your first product — it takes less than 5 minutes.\n\nTeam SellSquare",
                cta: "Add my first product",
              },
            },
            {
              sequenceNumber: 3,
              channel: "whatsapp",
              scheduledFor: day(4),
              status: "pending",
              templateContent: {
                body: "Hi {{contactName}} 👋, this is SellSquare. Your store *{{businessName}}* is live! Need help getting started? Reply to this message and our team will assist you.",
              },
            },
            {
              sequenceNumber: 4,
              channel: "email",
              scheduledFor: day(7),
              status: "pending",
              templateContent: {
                subject: "Tips to grow {{businessName}} on SellSquare",
                body: "Hi {{contactName}},\n\nHere are 3 things top sellers on SellSquare do in their first week:\n\n✅ Add at least 5 products with clear photos and descriptions\n✅ Enable the marketplace to reach buyers beyond your existing customers\n✅ Share your store link on WhatsApp and social media\n\nLog in to your dashboard to get started.\n\nTeam SellSquare",
                cta: "Go to my dashboard",
              },
            },
            {
              sequenceNumber: 5,
              channel: "email",
              scheduledFor: day(14),
              status: "pending",
              templateContent: {
                subject: "How is {{businessName}} doing on SellSquare?",
                body: "Hi {{contactName}},\n\nIt's been 2 weeks since {{businessName}} joined SellSquare! We'd love to hear how things are going.\n\nIf you have any questions, challenges, or feedback, reply to this email — our team reads every response.\n\nHere to help you grow,\nTeam SellSquare",
                cta: "Share my feedback",
              },
            },
          ],
        });

        console.log(`[Registration Followup] Seeded follow-up sequence for ${ownerEmail}`);
      } catch (err) {
        console.error("[Registration Followup] Failed to seed follow-up:", err.message);
      }
    })();

    const {
      _id,
      businessName,
      businessEmail,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPassword,
      businessPhone,
      businessAddress,
    } = businessRegistration;
    res.status(201).json({
      _id,
      businessName,
      businessEmail,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPassword,
      businessPhone,
      businessAddress,
      token,
    });
  } else {
    res.status(400);
    throw new Error("Invalid business data");
  }
});

// Sync owner identity (name, email, password) to all connected branches.
// Uses updateMany with bypass of pre-save hook to avoid double-hashing.
const syncOwnerToBranches = async (businessId, ownerFields) => {
  const business = await BusinessRegistration.findById(businessId);
  if (!business || !business.connectedStores || business.connectedStores.length === 0) return;

  const $set = {};
  if (ownerFields.firstName) $set["businessOwner.firstName"] = ownerFields.firstName;
  if (ownerFields.lastName) $set["businessOwner.lastName"] = ownerFields.lastName;
  if (ownerFields.email) $set["businessOwner.email"] = ownerFields.email;
  if (ownerFields.password) $set["businessOwner.password"] = ownerFields.password;

  if (Object.keys($set).length === 0) return;

  await BusinessRegistration.updateMany(
    { _id: { $in: business.connectedStores } },
    { $set }
  );
};

// Find all sibling stores owned by the same person (by shared businessOwner.email).
// Returns all OTHER businesses except excludeId, projected for display.
const findSiblingStores = async (ownerEmail, excludeId) => {
  if (!ownerEmail) return [];
  const escaped = ownerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return BusinessRegistration.find(
    {
      _id: { $ne: excludeId },
      "businessOwner.email": new RegExp(`^${escaped}$`, 'i'),
    },
    "businessName businessEmail photo industry country"
  );
};

// Login to Business
const loginToBusiness = asyncHandler(async (req, res) => {
  const { businessEmail, email, password } = req.body;

  // Validate Request - now only email + password required
  if (!email || !password) {
    res.status(400);
    throw new Error("Please add email and password");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Try to find the business via Email model first (new flow)
  let business = null;
  let emailRecord = await Email.findOne({ email: normalizedEmail });

  if (emailRecord) {
    business = await BusinessRegistration.findById(emailRecord.business);
  }

  // Backward compatibility: if businessEmail is provided and Email model lookup failed,
  // fall back to the old flow (for users who haven't been migrated yet)
  if (!business && businessEmail) {
    const normalizedBusinessEmail = businessEmail.toLowerCase().trim();
    business = await BusinessRegistration.findOne({
      businessEmail: normalizedBusinessEmail,
    });
  }

  // Last resort: search by owner email or salesRep email directly.
  // Sort by _id ascending to prefer the oldest (root) business when the
  // same owner email exists on multiple businesses (shared identity).
  if (!business) {
    business = await BusinessRegistration.findOne({
      $or: [
        { "businessOwner.email": { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { "salesRep.email": { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    }).sort({ _id: 1 });

    // If found via direct search, auto-create the Email record for future logins
    if (business) {
      const isOwner = business.businessOwner.email.toLowerCase() === normalizedEmail;
      try {
        await Email.create({
          email: normalizedEmail,
          business: business._id,
          isAdmin: isOwner,
        });
      } catch (dupErr) {
        // Ignore duplicate key errors from race conditions
        if (dupErr.code !== 11000) throw dupErr;
      }
    }
  }

  if (!business) {
    res.status(400);
    throw new Error("Account not found, please register");
  }

  async function isSalesRep(email, password) {
    for (const rep of business.salesRep) {
      if (rep.email.toLowerCase() === email.toLowerCase()) {
        const passwordMatch = await bcrypt.compare(password, rep.password);
        if (passwordMatch) {
          return true;
        }
      }
    }
    return false;
  }

  async function isBusinessOwner(email, password) {
    if (email.toLowerCase() === business.businessOwner.email.toLowerCase()) {
      return bcrypt.compare(password, business.businessOwner.password);
    }
    return false;
  }

  // Check if the user is a Business Owner or Sales Rep
  const isOwner = await isBusinessOwner(normalizedEmail, password);
  const isRep = await isSalesRep(normalizedEmail, password);

  if (!isOwner && !isRep) {
    res.status(400);
    throw new Error("Invalid email or password");
  }

  // Determine logged-in user type and send response
  let loggedInUser;

  if (isOwner) {
    loggedInUser = {
      _id: business._id,
      businessName: business.businessName,
      businessEmail: business.businessEmail,
      subscription: business.subscription,
      name: `${business.businessOwner.firstName} ${business.businessOwner.lastName}`,
      email: business.businessOwner.email,
      permissions: business.businessOwner.permissions,
      businessOwnerLoggedIn: true,
      salesLoggedIn: false,
      country: business.country,
      verified: business.verified,
    };
  } else if (isRep) {
    const salesRep = business.salesRep.find(
      (rep) => rep.email.toLowerCase() === normalizedEmail,
    );
    if (salesRep) {
      // Determine which business context to use for login
      // If staff has assigned stores, use the first one; otherwise use current business
      let loginBusiness = business;
      const branchAssignments = salesRep.branchAssignments || [];

      if (branchAssignments.length > 0) {
        // Login to the first assigned store
        const firstAssignedStoreId = branchAssignments[0].storeId;
        loginBusiness = await BusinessRegistration.findById(firstAssignedStoreId);
        if (!loginBusiness) {
          // Fallback to original business if assigned store not found
          loginBusiness = business;
        }
      }

      loggedInUser = {
        _id: loginBusiness._id,
        businessName: loginBusiness.businessName,
        businessEmail: loginBusiness.businessEmail,
        subscription: loginBusiness.subscription,
        name: `${salesRep.firstName} ${salesRep.lastName}`,
        email: salesRep.email,
        permissions: salesRep.permissions,
        businessOwnerLoggedIn: false,
        salesLoggedIn: true,
        country: loginBusiness.country,
        verified: loginBusiness.verified,
        branchAssignments: branchAssignments,
      };
    }
  }

  // Include all sibling stores for business owners (found by shared owner email)
  if (isOwner) {
    loggedInUser.connectedStores = await findSiblingStores(
      business.businessOwner.email, business._id
    );
  }

  // Include assigned stores for staff members
  if (isRep && loggedInUser) {
    const assignedStoreIds = (loggedInUser.branchAssignments || []).map((a) => a.storeId);
    if (assignedStoreIds.length > 0) {
      loggedInUser.connectedStores = await BusinessRegistration.find({
        _id: { $in: assignedStoreIds },
      }).select("_id businessName businessEmail photo industry country");
    } else {
      loggedInUser.connectedStores = [];
    }
  }

  // Generate Token with user claims for header-based auth fallback
  // Use loggedInUser._id which is either the business or assigned store
  const token = generateToken(loggedInUser._id, {
    email: loggedInUser?.email,
    name: loggedInUser?.name,
    permissions: loggedInUser?.permissions || [],
    businessOwnerLoggedIn: Boolean(loggedInUser?.businessOwnerLoggedIn),
    salesLoggedIn: Boolean(loggedInUser?.salesLoggedIn),
  });

  loggedInUser.token = token;

  // Send HTTP-only cookie with Monday-to-Monday expiration
  const millisecondsUntilMonday = getMillisecondsUntilNextMonday();
  const expirationDate = new Date(Date.now() + millisecondsUntilMonday);

  // Cookie options - use sameSite 'none' for cross-origin, 'lax' for same-origin
  // secure must be true in production, can be false in development
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    expires: expirationDate,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction, // Must be true when sameSite is 'none'
  };

  res.cookie("token", token, cookieOptions);
  res.cookie("loggedInUser", JSON.stringify(loggedInUser), cookieOptions);

  console.log(
    `[Auth] Login successful for ${normalizedEmail}, token expires: ${expirationDate.toISOString()}`,
  );

  res.status(200).json(loggedInUser);
});

/* Logout User */
const logout = asyncHandler(async (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const clearCookieOptions = {
    path: "/",
    httpOnly: true,
    expires: new Date(0),
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  res.cookie("token", "", clearCookieOptions);
  res.cookie("loggedInUser", "", clearCookieOptions);

  console.log("[Auth] User logged out");
  return res.status(200).json({ message: "Successfully Logged Out" });
});

// get Business
const getBusiness = asyncHandler(async (req, res) => {
  try {
    const business = await BusinessRegistration.findById(req.business._id);

    if (!business) {
      res.status(404).json({ message: "Business Not Found" });
      return;
    }

    // update Subscription for logged in user
    const { subscription } = business;
    let loggedInUser = req.loggedInUser;
    if (typeof loggedInUser === "string" && loggedInUser) {
      loggedInUser = JSON.parse(loggedInUser);
    }

    if (!loggedInUser) {
      loggedInUser = req.user || null;
    }

    if (loggedInUser) {
      loggedInUser.subscription = subscription;

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("loggedInUser", JSON.stringify(loggedInUser), {
        path: "/",
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 86400), // 1 day
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
      });
    }

    const {
      _id,
      businessName,
      businessEmail,
      businessAddress,
      businessPhone,
      photo,
      industry,
      country,
      businessOwner: {
        firstName: ownerFirstName,
        lastName: ownerLastName,
        email: ownerEmail,
      },
      businessOwner,
      salesRep: sales,
    } = business;

    // Determine connected stores based on user type
    let connectedStores;
    if (req.user?.salesLoggedIn) {
      // Staff member: return only assigned stores
      const staffEmail = req.user.email.toLowerCase();

      // Find the original business where the staff member was created
      const emailRecord = await Email.findOne({ email: staffEmail });
      let staffOriginBusiness = business;

      if (emailRecord) {
        staffOriginBusiness = await BusinessRegistration.findById(emailRecord.business);
      }

      const staffMember = staffOriginBusiness?.salesRep.find(
        (rep) => rep.email.toLowerCase() === staffEmail
      );

      if (staffMember && staffMember.branchAssignments && staffMember.branchAssignments.length > 0) {
        const assignedStoreIds = staffMember.branchAssignments.map((a) => a.storeId);
        connectedStores = await BusinessRegistration.find({
          _id: { $in: assignedStoreIds },
        }).select("_id businessName businessEmail photo industry country");
      } else {
        connectedStores = [];
      }
    } else {
      // Business owner: return all sibling stores
      connectedStores = await findSiblingStores(
        business.businessOwner.email, business._id
      );
    }

    res.status(200).json({
      _id,
      businessName,
      businessEmail,
      businessAddress,
      businessPhone,
      industry,
      country,
      photo,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      businessOwner,
      sales,
      subscription,
      connectedStores,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Login Status
const loginStatus = asyncHandler(async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : req.cookies.token;

  if (!token) {
    console.log("[Auth] loginStatus: No token in cookies");
    return res.status(401).json(false);
  }

  try {
    // Verify Token
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    if (verified) {
      // Check token expiry
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = verified.exp - now;
      console.log(
        `[Auth] loginStatus: Token valid, expires in ${Math.floor(
          expiresIn / 60,
        )} minutes`,
      );

      return res.json(true);
    }

    console.log("[Auth] loginStatus: Token verification returned falsy");
    return res.json(false);
  } catch (error) {
    console.log(
      `[Auth] loginStatus: Token verification failed - ${error.message}`,
    );
    return res.json(false);
  }
});

// Update Business
const updateBusiness = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business._id);

  if (business) {
    const {
      businessName,
      businessEmail,
      businessAddress,
      businessPhone,
      industry,
      photo,
      country,
    } = business;

    // Update business-level fields
    business.businessName = req.body.businessName || businessName;
    business.businessEmail = req.body.businessEmail || businessEmail;
    business.businessAddress = req.body.businessAddress || businessAddress;
    business.businessPhone = req.body.businessPhone || businessPhone;
    business.industry = req.body.industry || industry;
    business.photo = req.body.photo || photo;
    business.country = req.body.country || country;

    // Update businessOwner nested fields
    const ownerUpdates = {};
    if (req.body.ownerFirstName) {
      business.businessOwner.firstName = req.body.ownerFirstName;
      ownerUpdates.firstName = req.body.ownerFirstName;
    }
    if (req.body.ownerLastName) {
      business.businessOwner.lastName = req.body.ownerLastName;
      ownerUpdates.lastName = req.body.ownerLastName;
    }
    if (req.body.ownerEmail) {
      business.businessOwner.email = req.body.ownerEmail;
      ownerUpdates.email = req.body.ownerEmail;
    }

    const updatedBusiness = await business.save();

    // Sync owner identity changes to all connected branches
    if (Object.keys(ownerUpdates).length > 0) {
      await syncOwnerToBranches(business._id, ownerUpdates);

      // If owner email changed, update the Email model mapping
      if (ownerUpdates.email) {
        const normalizedNewEmail = ownerUpdates.email.toLowerCase().trim();
        await Email.findOneAndUpdate(
          { business: business._id, isAdmin: true },
          { email: normalizedNewEmail },
          { new: true }
        );
      }
    }

    const rawOwner = updatedBusiness.businessOwner?.toObject
      ? updatedBusiness.businessOwner.toObject()
      : updatedBusiness.businessOwner || {};
    const { password: ownerPassword, ...sanitizedOwner } = rawOwner;

    const sanitizedSales = (updatedBusiness.salesRep || []).map((rep) => {
      const rawRep = rep?.toObject ? rep.toObject() : rep || {};
      const { password, ...rest } = rawRep;
      return rest;
    });

    res.status(200).json({
      _id: updatedBusiness._id,
      businessName: updatedBusiness.businessName,
      businessEmail: updatedBusiness.businessEmail,
      businessAddress: updatedBusiness.businessAddress,
      businessPhone: updatedBusiness.businessPhone,
      industry: updatedBusiness.industry,
      country: updatedBusiness.country,
      photo: updatedBusiness.photo,
      ownerFirstName: sanitizedOwner.firstName,
      ownerLastName: sanitizedOwner.lastName,
      ownerEmail: sanitizedOwner.email,
      businessOwner: sanitizedOwner,
      sales: sanitizedSales,
      subscription: updatedBusiness.subscription,
      verified: updatedBusiness.verified,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business._id);
  const { oldPassword, password } = req.body;

  if (!business) {
    res.status(400);
    throw new Error("User not found, please signup");
  }

  // Validate input
  if (!oldPassword || !password) {
    res.status(400);
    throw new Error("Please provide both old and new passwords");
  }

  // Check if old password matches the business owner's password
  const passwordIsCorrect = await bcrypt.compare(
    oldPassword,
    business.businessOwner.password,
  );

  if (!passwordIsCorrect) {
    res.status(400);
    throw new Error("Old password is incorrect");
  }

  // Hash the new password and update via updateOne to bypass pre-save hook
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await BusinessRegistration.updateOne(
    { _id: business._id },
    { $set: { "businessOwner.password": hashedPassword } }
  );

  // Sync to all connected branches so the same owner can log in everywhere
  await syncOwnerToBranches(business._id, { password: hashedPassword });

  res
    .status(200)
    .json({ success: true, message: "Password change successful" });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, businessEmail, url } = req.body;
  const normalizedEmail = email?.toLowerCase()?.trim();

  if (!normalizedEmail) {
    res.status(400);
    throw new Error("Please provide your email address");
  }

  // Find business via Email model first, then fallback to old flow
  let business = null;
  const emailRecord = await Email.findOne({ email: normalizedEmail });

  if (emailRecord) {
    business = await BusinessRegistration.findById(emailRecord.business);
  }

  // Backward compatibility: try businessEmail if provided
  if (!business && businessEmail) {
    business = await BusinessRegistration.findOne({
      businessEmail: businessEmail.toLowerCase().trim(),
    });
  }

  // Last resort: direct search on business owner/salesRep emails
  if (!business) {
    business = await BusinessRegistration.findOne({
      $or: [
        { "businessOwner.email": { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { "salesRep.email": { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    });
  }

  if (!business) {
    res.status(404);
    throw new Error("No account found with this email. Please try again.");
  }

  // Delete existing token if it exists
  let token = await Token.findOne({ userId: business._id });
  if (token) {
    await token.deleteOne();
  }

  // Create Reset Token
  let resetToken = crypto.randomBytes(32).toString("hex") + business._id;

  // Hash token before saving to DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save Token to DB with 60 minutes expiry
  await new Token({
    userId: business._id,
    token: hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * (60 * 1000), // 60 minutes
  }).save();

  // Construct Reset URL - only include email parameter now
  const resetUrl = `${url}/resetpassword/${resetToken}?email=${normalizedEmail}`;

  console.log(resetUrl);

  const subject = "Password Reset Request";
  const send_to = normalizedEmail;
  const sent_from = process.env.EMAIL_FROM;

  try {
    await sendEmail(
      subject,
      {
        recipientEmail: normalizedEmail,
        resetUrl: resetUrl,
        expiresIn: 60,
      },
      send_to,
      sent_from,
      null,
      { template: "password-reset" },
    );
    res.status(200).json({ success: true, message: "Reset email sent" });
  } catch (error) {
    res.status(500);
    throw new Error("Email not sent, please try again");
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { resetToken } = req.params;
  const email = req?.query?.email?.toLowerCase()?.trim();
  // Backward compatibility: still accept businessEmail query param
  const businessEmail = req?.query?.businessEmail?.toLowerCase();

  // console.log(req.query)

  // Hash token, then compare to Token in DB
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Find token in DB
  const userToken = await Token.findOne({
    token: hashedToken,
    expiresAt: { $gt: Date.now() }, // Token must not be expired
  });

  if (!userToken) {
    res.status(404);
    throw new Error("Invalid or expired token");
  }

  // Find the business associated with the token
  const business = await BusinessRegistration.findOne({
    _id: userToken.userId,
  });
  if (!business) {
    res.status(404);
    throw new Error("Business not found");
  }

  // Find the specific user (either the business owner or sales rep) whose password needs to be reset
  let userToReset = null;

  // Check if the email matches the business owner's email
  if (email === business.businessOwner.email.toLowerCase()) {
    userToReset = business.businessOwner;
  } else {
    // Check if the email matches any of the sales representatives
    userToReset = business.salesRep.find(
      (rep) => rep.email.toLowerCase() === email,
    );
  }

  if (!userToReset) {
    res.status(404);
    throw new Error("User not found");
  }

  // Hash the new password before saving
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const isOwnerReset = email === business.businessOwner.email.toLowerCase();

  if (isOwnerReset) {
    // Update owner password via updateOne (bypass pre-save hook)
    await BusinessRegistration.updateOne(
      { _id: business._id },
      { $set: { "businessOwner.password": hashedPassword } }
    );
    // Sync to all connected branches
    await syncOwnerToBranches(business._id, { password: hashedPassword });
  } else {
    // Sales rep — update their specific entry
    userToReset.password = hashedPassword;
    await BusinessRegistration.updateOne(
      { _id: business._id },
      { $set: { salesRep: business.salesRep } }
    );
  }

  // Optionally delete the token after successful password reset
  await userToken.deleteOne();

  res.status(200).json({
    success: true,
    message: "Password reset successful, please log in",
  });
});

const addNewSales = asyncHandler(async (req, res) => {
  try {
    const newSalesRep = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      permissions: req.body.permissions,
      branchAssignments: req.body.branchAssignments || [],
    };

    const normalizedSalesEmail = newSalesRep.email.toLowerCase().trim();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newSalesRep.password, salt);

    // Check if a salesRep with the given email already exists
    const business = await BusinessRegistration.findById(req.business.id);
    const salesRepExists = business.salesRep.some(
      (salesRep) => salesRep.email === newSalesRep.email,
    );

    if (business.businessOwner.email === newSalesRep.email) {
      throw new Error("Sales email cannot be business owner email");
    }

    if (business.businessEmail === newSalesRep.email) {
      throw new Error("Sales email cannot be business email");
    }

    if (salesRepExists) {
      throw new Error("A sales Rep with this email exists!");
    }

    // Check if email is already registered globally
    const emailExists = await Email.findOne({ email: normalizedSalesEmail });
    if (emailExists) {
      throw new Error("This email is already registered to another account");
    }

    const newBusiness = await BusinessRegistration.updateOne(
      { _id: req.business._id },
      { $push: { salesRep: { ...newSalesRep, password: hashedPassword } } },
    );

    // Create Email record for the new sales rep
    // Important: Email.business must point to where the salesRep record actually exists
    // (the business where they were created), not an assigned store.
    // The actual default store assignment happens when they first login -
    // the loginToBusiness function sets req.business to the first assigned store if available
    await Email.create({
      email: normalizedSalesEmail,
      business: req.business._id,
      isAdmin: false,
    });

    logActivity(`Added sales representative "${newSalesRep.firstName} ${newSalesRep.lastName}" (${normalizedSalesEmail})`)(req, res);

    return res.status(200).json(newBusiness);
  } catch (error) {
    throw new Error(`${error}`);
  }
});

const deleteSalesRep = asyncHandler(async (req, res) => {
  const { email } = req.body;

  console.log(email);

  const business = await BusinessRegistration.updateOne(
    { _id: req.business._id },
    { $pull: { salesRep: { email: email } } },
  );

  if (business.modifiedCount === 0) {
    res.status(404).json({ message: "Sales representative not found." });
  } else {
    // Remove the Email record for this sales rep
    await Email.deleteOne({ email: email.toLowerCase().trim() });
    logActivity(`Deleted sales representative (${email})`)(req, res);
    res
      .status(200)
      .json({ message: "Sales representative deleted successfully." });
  }
});

const updateSalesRep = asyncHandler(async (req, res) => {
  const sales = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    permissions: req.body.permissions,
    password: req.body.password,
    _id: req.body._id,
    branchAssignments: req.body.branchAssignments || [],
  };

  // console.log("sales", sales)

  const updatedSalesRep = await BusinessRegistration.updateOne(
    { _id: req.business._id, "salesRep._id": sales._id },
    { $set: { "salesRep.$": sales } },
  );

  if (updatedSalesRep) {
    logActivity(`Updated sales representative "${sales.firstName} ${sales.lastName}" (${sales.email})`)(req, res);
    res.status(200).json({
      data: "successfully updated",
      updatedSalesRep: updatedSalesRep,
    });
  } else {
    res.status(404).json({ message: "Sales representative not found." });
  }
});

const subscribe = asyncHandler(async (req, res) => {
  const { plan, subscriptionType } = req.body;

  const business = await BusinessRegistration.findById(req.business._id);

  if (business) {
    const newSubscription = {
      isSubscribed: true,
      subscriptionType: subscriptionType,
      plan: plan,
      nextDueDate: Date.now() + 31 * 24 * 60 * 60 * 1000, // 31 days from now
    };

    business.subscription = newSubscription;

    const updatedBusiness = await business.save();

    logActivity(`Updated subscription plan to "${plan}" (${subscriptionType})`)(req, res);

    res.status(200).json({
      _id: updatedBusiness._id,
      businessName: updatedBusiness.businessName,
      businessEmail: updatedBusiness.businessEmail,
      businessAddress: updatedBusiness.businessAddress,
      businessPhone: updatedBusiness.businessPhone,
      industry: updatedBusiness.industry,
      country: updatedBusiness.country,
      photo: updatedBusiness.photo,
      ownerFirstName: updatedBusiness.businessOwner.firstName,
      ownerLastName: updatedBusiness.businessOwner.lastName,
      ownerEmail: updatedBusiness.businessOwner.email,
      sales: updatedBusiness.salesRep,
      subscription: updatedBusiness.subscription,
    });
  } else {
    res.status(404);
    throw new Error("Business not found");
  }
});

const getAllBusiness = asyncHandler(async (req, res) => {
  if (hasAdminBusinessAccess(req.business)) {
    const businesses = await BusinessRegistration.find().sort("-createdAt");

    // Fetch additional information for each business
    const businessData = await Promise.all(
      businesses.map(async (business) => {
        const businessId = business._id;

        // Get the count of products
        const productCount = await Product.countDocuments({
          business: businessId,
        });

        // Get the count of checkout sessions
        const checkoutCount = await CheckOut.countDocuments({
          business: businessId,
        });

        // Get the count of product groups
        const productGroupCount = await ProductGroup.countDocuments({
          business: businessId,
        });

        // Calculate total revenue from checkouts
        const checkouts = await CheckOut.find({ business: businessId }).select(
          "items",
        );
        let totalRevenue = 0;
        checkouts.forEach((checkout) => {
          if (checkout.items && checkout.items.length > 0) {
            checkout.items.forEach((item) => {
              const price = parseFloat(item.price) || 0;
              const quantity = parseFloat(item.quantity) || 0;
              totalRevenue += price * quantity;
            });
          }
        });

        // Get the latest update time for products
        const lastProductUpdate = await Product.findOne({
          business: businessId,
        })
          .sort("-updatedAt")
          .select("updatedAt");

        // Get the latest update time for checkout sessions
        const lastCheckoutUpdate = await CheckOut.findOne({
          business: businessId,
        })
          .sort("-updatedAt")
          .select("updatedAt");

        // Get the latest update time for product groups
        const lastProductGroupUpdate = await ProductGroup.findOne({
          business: businessId,
        })
          .sort("-updatedAt")
          .select("updatedAt");

        return {
          ...business.toObject(),
          productCount,
          checkoutCount,
          productGroupCount,
          totalRevenue,
          lastProductUpdate: lastProductUpdate
            ? lastProductUpdate.updatedAt
            : null,
          lastCheckoutUpdate: lastCheckoutUpdate
            ? lastCheckoutUpdate.updatedAt
            : null,
          lastProductGroupUpdate: lastProductGroupUpdate
            ? lastProductGroupUpdate.updatedAt
            : null,
        };
      }),
    );

    res.json({
      businesses: businessData,
    });
  } else {
    return res.status(403).send({
      message: "Access Denied by admin.",
    });
  }
});

const verifySendGrid = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business._id);

  try {
    const response = await authenticateSender(business);
    console.log("Response from calling authenticate", response);
    business.verified = {
      sendgrid: true,
    };
    await business.save();
    res.status(201).json(response);
  } catch (error) {
    console.log(error);
  }
});

// Send Receipt Email
const sendReceiptEmail = asyncHandler(async (req, res, next) => {
  const { toEmail, sale } = req.body;
  const business = await BusinessRegistration.findById(req.business.id);

  const checkOut = await CheckOut.findOne({ _id: sale._id });

  if (checkOut.receipt === undefined) {
    const receipt = await createReceipt({
      data: checkOut,
      business: req.business.businessName,
      logo: req.business.photo,
      businessAddress: req.business.businessAddress,
      businessPhone: req.business.businessPhone,
      customer: checkOut.customer,
      orderId: checkOut.orderId,
    });

    checkOut.receipt = receipt?.Location;
    await checkOut.save();
  }

  // console.log("Business", req.body);
  const attachments = [
    {
      filename: "receipt.pdf",
      path: checkOut.receipt,
      contentType: "application/pdf",
    },
  ];

  const senders = await getSendersList();

  const sender = senders?.find(
    (sender) => sender.from.email === business.businessEmail,
  );

  const send_to = toEmail;
  const subject = "Your purchase Receipt!";
  let sent_from = null;
  let reply_to = null;
  if (sender && sender.verified.status === true) {
    if (business.verified) {
      business.verified.sendgrid = true;
      await business.save();
    }
    sent_from = sender.from.email;
    reply_to = sender.reply_to.email;
  } else {
    sent_from = process.env.EMAIL_USER;
    reply_to = process.env.EMAIL_USER;
  }

  const message = `
    <h2>Hello, ${send_to}</h2>
    <h3>Thank you for your purchase at ${business.businessName}! We have attached your receipt!</h3>
    <p>Regards,<br />${business.businessName}</p>
  `;

  try {
    await sendEmailWithAttachment(
      subject,
      message,
      send_to,
      sent_from,
      reply_to,
      attachments,
    );
    res
      .status(200)
      .json({ success: true, message: `Receipt sent to ${send_to}` });
    //  log activity
    const activity = "sent receipt to " + send_to;
    logActivity(activity)(req, res, next);
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Share receipt
const shareReceipt = asyncHandler(async (req, res, next) => {
  const id = req.query.id;
  const checkOut = await CheckOut.findOne({ _id: id });

  try {
    if (checkOut) {
      if (checkOut.receipt === undefined) {
        const receipt = await createReceipt({
          data: checkOut,
          business: req.business.businessName,
          logo: req.business.photo,
          businessAddress: req.business.businessAddress,
          businessPhone: req.business.businessPhone,
          customer: checkOut.customer,
          orderId: checkOut.orderId,
        });

        checkOut.receipt = receipt?.Location;
        await checkOut.save();
      }

      const readStream = getFileStream(`${checkOut._id}.pdf`);

      // log activity
      const activity = "shared receipt with " + checkOut.customer.name;
      logActivity(activity)(req, res, next);

      res.attachment(`${checkOut._id}.pdf`);
      readStream.pipe(res);
    } else {
      res.status(404).send("Receipt not found");
    }
  } catch (error) {
    res.status(500).send("Error fetching receipt");
    console.error(error);
  }
});

const activateActivityStatus = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business.id);
  if (business) {
    business.subscription.businessActivities = true;
    await business.save();
    res
      .status(200)
      .json({ message: "This business will start receiving activity status" });
  } else {
    res.status(404).json({ message: "business not found" });
  }
});

const getAllBusinessActivities = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const totalCount = await Activities.countDocuments({
    business: req.business.id,
    activity: { $not: /^Marketplace /i },
  });
  const activities = await Activities.find({
    business: req.business.id,
    activity: { $not: /^Marketplace /i },
  })
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    activities,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount: totalCount,
      limit: limit,
      hasMore: page * limit < totalCount,
    },
  });
});

// update a business's subscription using its id
const updateSubscriptionPlan = asyncHandler(async (req, res) => {
  const { subscriptionType, plan, nextDueDate } = req.body;
  const { businessId } = req.params;

  // console.log("body", req.body)
  // console.log("params", req.params.businessId)

  if (hasAdminBusinessAccess(req.business)) {
    const business = await BusinessRegistration.findById(businessId);

    if (business) {
      business.subscription = {
        subscriptionType: subscriptionType,
        plan: plan,
        nextDueDate: new Date(nextDueDate),
      };

      const updatedBusiness = await business.save();

      res.status(200).json({
        message: "Subscription updated successfully",
        subscription: updatedBusiness.subscription,
      });
    } else {
      res.status(404);
      throw new Error("Business not found");
    }
  } else {
    throw new Error("Access Denied | Operation not allowed");
  }
});

const sendAdminBusinessMessage = asyncHandler(async (req, res) => {
  if (!hasAdminBusinessAccess(req.business)) {
    res.status(403);
    throw new Error("Access Denied | Operation not allowed");
  }

  const {
    businessIds,
    recipientType = "owner",
    purpose = "custom",
    subject,
    message,
    replyTo,
  } = req.body || {};

  if (!Array.isArray(businessIds) || businessIds.length === 0) {
    res.status(400);
    throw new Error("businessIds must be a non-empty array");
  }

  if (businessIds.length > 100) {
    res.status(400);
    throw new Error("Cannot send to more than 100 businesses at once");
  }

  const allowedRecipientTypes = ["owner", "business"];
  if (!allowedRecipientTypes.includes(recipientType)) {
    res.status(400);
    throw new Error("recipientType must be one of: owner, business");
  }

  const template = ADMIN_COMMUNICATION_DEFAULTS[purpose];
  if (!template) {
    res.status(400);
    throw new Error(
      `purpose must be one of: ${Object.keys(ADMIN_COMMUNICATION_DEFAULTS).join(
        ", "
      )}`
    );
  }

  const results = [];
  const skipped = [];

  for (const businessId of businessIds) {
    const targetBusiness = await BusinessRegistration.findById(businessId);
    if (!targetBusiness) {
      skipped.push({ businessId, reason: "Business not found" });
      continue;
    }

    const ownerName = `${targetBusiness.businessOwner?.firstName || ""} ${
      targetBusiness.businessOwner?.lastName || ""
    }`.trim();
    const variables = {
      businessName: targetBusiness.businessName || "Business",
      ownerName: ownerName || "Business Owner",
      plan: targetBusiness.subscription?.plan || "N/A",
      dueDate: targetBusiness.subscription?.nextDueDate
        ? moment(targetBusiness.subscription.nextDueDate).format("MMM D, YYYY")
        : "N/A",
    };

    const resolvedSubject = interpolateAdminMessage(
      subject || template.subject,
      variables
    ).trim();
    const resolvedMessage = interpolateAdminMessage(
      message || template.message,
      variables
    ).trim();

    if (!resolvedSubject || !resolvedMessage) {
      skipped.push({ businessId, reason: "Resolved subject or message is empty" });
      continue;
    }

    const recipientEmail =
      recipientType === "business"
        ? targetBusiness.businessEmail
        : targetBusiness.businessOwner?.email;

    if (!recipientEmail) {
      skipped.push({
        businessId,
        businessName: targetBusiness.businessName,
        reason: "No recipient email available",
      });
      continue;
    }

    await sendEmail(
      resolvedSubject,
      {
        appName: "Sell Square",
        messageContent: resolvedMessage,
      },
      recipientEmail,
      process.env.EMAIL_FROM,
      replyTo || null,
      { template: "generic" }
    );

    results.push({
      businessId: targetBusiness._id,
      businessName: targetBusiness.businessName,
      recipientEmail,
      subject: resolvedSubject,
    });
  }

  res.status(200).json({
    success: true,
    message: `Message sent to ${results.length} business${results.length !== 1 ? "es" : ""}`,
    data: { sent: results, skipped },
  });
});

const sendMonthlyReport = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business.id);

  const activities = await Activities.find({
    business: req.business.id,
    activity: { $not: /^Marketplace /i },
    createdAt: {
      $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
    },
  }).sort("-createdAt");

  const report = activities.map((activity) => {
    return {
      activity: activity.activity,
      createdAt: activity.createdAt,
    };
  });

  const message = `
    <h2>Monthly Activity Report</h2>
    <p>Here is a summary of activities for the past 30 days:</p>
    <ul>
      ${report
        .map(
          (activity) =>
            `<li>${
              activity.activity
            } - ${activity.createdAt.toDateString()}</li>`,
        )
        .join("")}
    </ul>
    <p>Regards,<br />${business.businessName}</p>
  `;

  const subject = "Monthly Activity Report";
  const send_to = business.businessOwner.email;
  const sent_from = process.env.EMAIL_USER;

  try {
    await sendEmail(subject, message, send_to, sent_from);
    res.status(200).json({ success: true, message: "Report sent" });
  } catch (error) {
    res.status(500);
    throw new Error("Email not sent, please try again");
  }
});

// Manual cleanup of old activities (admin function)
const cleanupActivities = asyncHandler(async (req, res) => {
  const result = await manualCleanupOldActivities();

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
});

// ==================== Store Management ====================

// Get connected stores for the current business
const getConnectedStores = asyncHandler(async (req, res) => {
  const business = await BusinessRegistration.findById(req.business._id);

  if (!business) {
    res.status(404);
    throw new Error("Business not found");
  }

  let connectedStores;

  // If user is staff (salesLoggedIn), return only their assigned branches
  if (req.user?.salesLoggedIn) {
    const staffEmail = req.user.email.toLowerCase();

    // Find the original business where the staff member was created
    const emailRecord = await Email.findOne({ email: staffEmail });
    let staffOriginBusiness = business;

    if (emailRecord) {
      staffOriginBusiness = await BusinessRegistration.findById(emailRecord.business);
    }

    const staffMember = staffOriginBusiness?.salesRep.find(
      (rep) => rep.email.toLowerCase() === staffEmail
    );

    if (staffMember && staffMember.branchAssignments) {
      // Get the details of assigned stores
      const assignedStoreIds = staffMember.branchAssignments.map((a) => a.storeId);
      connectedStores = await BusinessRegistration.find({
        _id: { $in: assignedStoreIds },
      }).select(
        "_id businessName businessEmail photo industry country"
      );
    } else {
      connectedStores = [];
    }
  } else {
    // Owner can see all sibling stores
    connectedStores = await findSiblingStores(
      business.businessOwner.email, business._id
    );
  }

  res.status(200).json({
    currentBusiness: {
      _id: business._id,
      businessName: business.businessName,
      businessEmail: business.businessEmail,
      photo: business.photo,
      industry: business.industry,
      country: business.country,
    },
    connectedStores: connectedStores,
  });
});

// Connect an existing business by verifying admin credentials
const connectStore = asyncHandler(async (req, res) => {
  // Only business owners can connect stores
  if (!req.user?.businessOwnerLoggedIn) {
    res.status(403);
    throw new Error("Only the business owner can connect stores");
  }

  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide the admin email and password of the business to connect");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const currentBusiness = await BusinessRegistration.findById(req.business._id);

  if (!currentBusiness) {
    res.status(404);
    throw new Error("Current business not found");
  }

  // Find the target business — exclude current business to avoid self-match
  // when the same owner email exists on both (shared identity across branches)
  const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');

  let targetBusiness = await BusinessRegistration.findOne({
    _id: { $ne: currentBusiness._id },
    $or: [
      { "businessOwner.email": emailRegex },
      { businessEmail: emailRegex },
    ],
  });

  if (!targetBusiness) {
    res.status(404);
    throw new Error("No business found with this email");
  }

  // Cannot connect to self
  if (targetBusiness._id.toString() === currentBusiness._id.toString()) {
    res.status(400);
    throw new Error("Cannot connect a business to itself");
  }

  // Check if already connected
  if (currentBusiness.connectedStores &&
      currentBusiness.connectedStores.some(id => id.toString() === targetBusiness._id.toString())) {
    res.status(400);
    throw new Error("This business is already connected");
  }

  // Verify the admin password of the target business
  const passwordMatch = await bcrypt.compare(password, targetBusiness.businessOwner.password);
  if (!passwordMatch) {
    res.status(400);
    throw new Error("Invalid admin password for the target business");
  }

  // Transfer admin: update target business's owner to match current business's owner.
  // Use updateOne to bypass the pre-save hook which would double-hash the
  // already-hashed password being copied from currentBusiness.
  const oldOwnerEmail = targetBusiness.businessOwner.email.toLowerCase().trim();

  await BusinessRegistration.updateOne(
    { _id: targetBusiness._id },
    {
      $set: {
        "businessOwner.firstName": currentBusiness.businessOwner.firstName,
        "businessOwner.lastName": currentBusiness.businessOwner.lastName,
        "businessOwner.email": currentBusiness.businessOwner.email,
        "businessOwner.password": currentBusiness.businessOwner.password,
      },
    }
  );

  // Clean up the old owner's Email record — it now points to a business
  // they no longer own. Remove it so they aren't routed there on login.
  const newOwnerEmail = currentBusiness.businessOwner.email.toLowerCase().trim();
  if (oldOwnerEmail !== newOwnerEmail) {
    await Email.deleteOne({ email: oldOwnerEmail, business: targetBusiness._id });
  }

  // Add bidirectional connection
  await BusinessRegistration.findByIdAndUpdate(currentBusiness._id, {
    $addToSet: { connectedStores: targetBusiness._id },
  });
  await BusinessRegistration.findByIdAndUpdate(targetBusiness._id, {
    $addToSet: { connectedStores: currentBusiness._id },
  });

  // Re-fetch with populated data
  const updatedBusiness = await BusinessRegistration.findById(currentBusiness._id)
    .populate("connectedStores", "businessName businessEmail photo industry country");

  res.status(200).json({
    message: "Business connected successfully",
    connectedStores: updatedBusiness.connectedStores || [],
  });
});

// Register a new business and connect it to the current business
const registerAndConnectStore = asyncHandler(async (req, res) => {
  // Only business owners can create and register new branches
  if (!req.user?.businessOwnerLoggedIn) {
    res.status(403);
    throw new Error("Only the business owner can create and register new branches");
  }

  const {
    businessName,
    businessEmail,
    businessAddress,
    businessPhone,
    industry,
    country,
    photo,
  } = req.body;

  if (!businessName || !businessEmail) {
    res.status(400);
    throw new Error("Business name and email are required");
  }

  const currentBusiness = await BusinessRegistration.findById(req.business._id);

  if (!currentBusiness) {
    res.status(404);
    throw new Error("Current business not found");
  }

  // Check if business email already exists
  const normalizedBusinessEmail = businessEmail.toLowerCase().trim();
  const businessExists = await BusinessRegistration.findOne({
    businessEmail: normalizedBusinessEmail,
  });

  if (businessExists) {
    res.status(400);
    throw new Error("A business with this email already exists");
  }

  // Create the new business with current owner as admin.
  // Use insertOne to bypass the pre-save hook which would double-hash
  // the already-hashed password copied from currentBusiness.
  const newBusinessDoc = {
    businessName,
    businessEmail: normalizedBusinessEmail,
    businessAddress: businessAddress || "",
    businessPhone: businessPhone || "",
    photo: photo || "https://i.ibb.co/4pDNDk1/avatar.png",
    industry: industry || currentBusiness.industry,
    country: country || currentBusiness.country,
    businessOwner: {
      firstName: currentBusiness.businessOwner.firstName,
      lastName: currentBusiness.businessOwner.lastName,
      email: currentBusiness.businessOwner.email,
      password: currentBusiness.businessOwner.password, // already hashed
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
    connectedStores: [currentBusiness._id],
    subscription: {
      isSubscribed: true,
      subscriptionType: "recurring",
      plan: "Free",
      businessActivities: false,
      nextDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    verified: { sendgrid: false },
  };

  const insertResult = await BusinessRegistration.collection.insertOne(newBusinessDoc);
  const newBusiness = await BusinessRegistration.findById(insertResult.insertedId);

  // The owner's Email record already points to the primary business.
  // We do NOT create a duplicate — the connectedStores array is what
  // grants access to multiple businesses for the same owner.

  // Add connection on the current business
  await BusinessRegistration.findByIdAndUpdate(currentBusiness._id, {
    $addToSet: { connectedStores: newBusiness._id },
  });

  // Re-fetch with populated data
  const updatedBusiness = await BusinessRegistration.findById(currentBusiness._id)
    .populate("connectedStores", "businessName businessEmail photo industry country");

  res.status(201).json({
    message: "New business created and connected",
    newBusiness: {
      _id: newBusiness._id,
      businessName: newBusiness.businessName,
      businessEmail: newBusiness.businessEmail,
      photo: newBusiness.photo,
      industry: newBusiness.industry,
      country: newBusiness.country,
    },
    connectedStores: updatedBusiness.connectedStores || [],
  });
});

// Switch to a connected business - generates new token
const switchBusiness = asyncHandler(async (req, res) => {
  const { businessId } = req.body;

  if (!businessId) {
    res.status(400);
    throw new Error("Please provide the business ID to switch to");
  }

  const currentBusiness = await BusinessRegistration.findById(req.business._id);

  if (!currentBusiness) {
    res.status(404);
    throw new Error("Current business not found");
  }

  const targetBusiness = await BusinessRegistration.findById(businessId);

  if (!targetBusiness) {
    res.status(404);
    throw new Error("Target business not found");
  }

  const isSelf = currentBusiness._id.toString() === businessId;

  // Check if user is currently logged in as owner
  const isCurrentUserOwner = req.user?.businessOwnerLoggedIn;

  // Check if user is staff with access to target branch
  let isStaffWithAccess = false;
  let staffMember = null;
  let staffPermissions = null;

  if (req.user?.salesLoggedIn) {
    // User is logged in as staff, check if they have this branch assigned
    const staffEmail = req.user.email.toLowerCase();

    // Find the original business where this staff member was created
    // (via the Email model) instead of looking in currentBusiness
    const emailRecord = await Email.findOne({ email: staffEmail });
    let staffOriginBusiness = currentBusiness;

    if (emailRecord) {
      staffOriginBusiness = await BusinessRegistration.findById(emailRecord.business);
    }

    if (staffOriginBusiness) {
      staffMember = staffOriginBusiness.salesRep.find(
        (rep) => rep.email.toLowerCase() === staffEmail
      );
    }

    if (
      staffMember &&
      staffMember.branchAssignments &&
      staffMember.branchAssignments.some((assignment) =>
        assignment.storeId.toString() === businessId
      )
    ) {
      isStaffWithAccess = true;
      staffPermissions = staffMember.permissions;
    }
  }

  // Check if user can access the target business
  const canAccessTargetBusiness = isSelf ||
    (isCurrentUserOwner && currentBusiness.businessOwner.email.toLowerCase() === targetBusiness.businessOwner.email.toLowerCase()) ||
    isStaffWithAccess;

  if (!canAccessTargetBusiness) {
    res.status(403);
    throw new Error("You don't have access to this business");
  }

  // Build logged in user based on who is switching
  let loggedInUser;

  if (isCurrentUserOwner) {
    // Current user is logged in as owner - switch as owner
    loggedInUser = {
      _id: targetBusiness._id,
      businessName: targetBusiness.businessName,
      businessEmail: targetBusiness.businessEmail,
      subscription: targetBusiness.subscription,
      name: `${targetBusiness.businessOwner.firstName} ${targetBusiness.businessOwner.lastName}`,
      email: targetBusiness.businessOwner.email,
      permissions: targetBusiness.businessOwner.permissions,
      businessOwnerLoggedIn: true,
      salesLoggedIn: false,
      country: targetBusiness.country,
      verified: targetBusiness.verified,
      connectedStores: await findSiblingStores(
        targetBusiness.businessOwner.email, targetBusiness._id
      ),
    };
  } else if (isStaffWithAccess && staffMember) {
    // Current user is logged in as staff - switch as staff
    // Fetch the full store details for the assigned branches
    let assignedStores = [];
    if (staffMember.branchAssignments && staffMember.branchAssignments.length > 0) {
      const assignedStoreIds = staffMember.branchAssignments.map((a) => a.storeId);
      assignedStores = await BusinessRegistration.find({
        _id: { $in: assignedStoreIds },
      }).select("_id businessName businessEmail photo industry country");
    }

    loggedInUser = {
      _id: targetBusiness._id,
      businessName: targetBusiness.businessName,
      businessEmail: targetBusiness.businessEmail,
      subscription: targetBusiness.subscription,
      name: `${staffMember.firstName} ${staffMember.lastName}`,
      email: staffMember.email,
      permissions: staffPermissions,
      businessOwnerLoggedIn: false,
      salesLoggedIn: true,
      country: targetBusiness.country,
      verified: targetBusiness.verified,
      connectedStores: assignedStores,
      branchAssignments: staffMember.branchAssignments,
    };
  } else {
    // Fallback (shouldn't reach here due to access check above)
    res.status(403);
    throw new Error("Invalid user state for business switching");
  }

  // Generate new token for the target business
  const token = generateToken(targetBusiness._id, {
    email: loggedInUser.email,
    name: loggedInUser.name,
    permissions: loggedInUser.permissions || [],
    businessOwnerLoggedIn: loggedInUser.businessOwnerLoggedIn,
    salesLoggedIn: loggedInUser.salesLoggedIn,
  });

  loggedInUser.token = token;

  // Set cookies for the new business context
  const millisecondsUntilMonday = getMillisecondsUntilNextMonday();
  const expirationDate = new Date(Date.now() + millisecondsUntilMonday);
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    expires: expirationDate,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };

  res.cookie("token", token, cookieOptions);
  res.cookie("loggedInUser", JSON.stringify(loggedInUser), cookieOptions);

  console.log(
    `[Auth] Business switched to ${targetBusiness.businessName} (${targetBusiness._id})`,
  );

  res.status(200).json(loggedInUser);
});

// Disconnect a store from the current business
const disconnectStore = asyncHandler(async (req, res) => {
  // Only business owners can disconnect stores
  if (!req.user?.businessOwnerLoggedIn) {
    res.status(403);
    throw new Error("Only the business owner can disconnect stores");
  }

  const { businessId } = req.body;

  if (!businessId) {
    res.status(400);
    throw new Error("Please provide the business ID to disconnect");
  }

  const currentBusiness = await BusinessRegistration.findById(req.business._id);

  if (!currentBusiness) {
    res.status(404);
    throw new Error("Current business not found");
  }

  // Remove bidirectional connection
  await BusinessRegistration.findByIdAndUpdate(currentBusiness._id, {
    $pull: { connectedStores: businessId },
  });
  await BusinessRegistration.findByIdAndUpdate(businessId, {
    $pull: { connectedStores: currentBusiness._id },
  });

  // Re-fetch with populated data
  const updatedBusiness = await BusinessRegistration.findById(currentBusiness._id)
    .populate("connectedStores", "businessName businessEmail photo industry country");

  res.status(200).json({
    message: "Business disconnected successfully",
    connectedStores: updatedBusiness.connectedStores || [],
  });
});

module.exports = {
  registerBusiness,
  // loginUser,
  deleteSalesRep,
  updateSalesRep,
  loginToBusiness,
  logout,
  getBusiness,
  loginStatus,
  updateBusiness,
  changePassword,
  forgotPassword,
  resetPassword,
  addNewSales,
  subscribe,
  getAllBusiness,
  verifySendGrid,
  sendReceiptEmail,
  shareReceipt,
  activateActivityStatus,
  getAllBusinessActivities,
  updateSubscriptionPlan,
  sendAdminBusinessMessage,
  cleanupActivities,
  getConnectedStores,
  connectStore,
  registerAndConnectStore,
  switchBusiness,
  disconnectStore,
};
