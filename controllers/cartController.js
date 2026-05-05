const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const CheckOut = require("../models/checkOutSalesModel");
const { createReceipt } = require("../utils/fileDownload");
const { getFileStream } = require("../utils/s3bucket");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const ProductGroup = require("../models/productGroupModel");
const fs = require("fs");
const qs = require("qs");
const {
  sendMessage,
  getTemplatedMessageInput,
} = require("../utils/sendMessageHelper");
const { sendSMS } = require("../utils/sendSMS");
const { printReceipt } = require("../utils/printReceipt");
const logActivity = require("../middleWare/logActivityMiddleware");
const mongoose = require("mongoose");
const BusinessRegistration = require("../models/businessRegistration");
const { eventBus, EventTypes } = require("../events");
const {
  updateProductSalesMetrics,
  updateGroupSalesMetrics,
} = require("../utils/historyTracking");
const { resolveEffectiveDiscount } = require("../services/marketplace/discountResolver");

const RECORDED_SALES_DISCOUNT_TYPES = ["recorded_sales"];

const s3 = new AWS.S3({
  AWS_SDK_LOAD_CONFIG: 1,
  region: "us-east-2",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const updateProductGroup = async (product) => {
  if (product.productIsaGroup && product.isProductUnique) {
    const productGroup = await ProductGroup.findById(product.itemGroup);

    let productIndex = productGroup.combinations.findIndex(
      (comb) => comb === product.name,
    );

    const newCombinations = productGroup.combinations.filter(
      (comb, index) => index !== productIndex,
    );

    if (productIndex > -1) {
      try {
        await ProductGroup.findByIdAndUpdate(
          { _id: product.itemGroup },
          {
            $set: {
              sku: productGroup.sku.filter(
                (_, index) => index !== productIndex,
              ),
              cost: productGroup.cost.filter(
                (_, index) => index !== productIndex,
              ),
              price: productGroup.price.filter(
                (_, index) => index !== productIndex,
              ),
              warehouse: productGroup.warehouse.filter(
                (_, index) => index !== productIndex,
              ),
              quantity: productGroup.quantity.filter(
                (_, index) => index !== productIndex,
              ),
              combinations: newCombinations,
            },
          },
          {
            new: true,
            runValidators: true,
          },
        );
      } catch (error) {
        console.log("There is an error", error.message);
      }
    }
  }
};

const removeFromCombined = async (product) => {
  try {
    const combinationToRemove = product.name.trim().toLowerCase();

    const productGroup = await ProductGroup.findById(product.itemGroup);
    if (!productGroup) {
      throw new Error("Product group not found");
    }

    const index = productGroup.combinations.findIndex(
      (combination) => combination.trim().toLowerCase() === combinationToRemove,
    );

    if (index >= 0) {
      const update = {};

      productGroup.options.forEach((optionGroup, optionGroupIndex) => {
        const attrArray = optionGroup.attr;
        if (index < attrArray.length) {
          attrArray.splice(index + 1, 1);
          update[`options.${optionGroupIndex}.attr`] = attrArray;
        }
      });

      const updatedProductGroup = await ProductGroup.findByIdAndUpdate(
        product.itemGroup,
        { $set: update },
        { new: true },
      );

      return updatedProductGroup;
    } else {
      return productGroup;
    }
  } catch (error) {
    throw error;
  }
};

const generateOrderId = (businessName) => {
  const randomFourDigits = Math.floor(1000 + Math.random() * 9000); // Generate a random 4-digit number
  const orderId = `${businessName.substring(0, 4)}${randomFourDigits}`; // Combine first 4 letters of business name and random number
  return orderId.toUpperCase(); // Convert to uppercase for consistency
};

// Helpers for totals and payment normalization
const toNumber = (value) => Number(value) || 0;
const computeTotalOrderCost = (items = []) => {
  return items.reduce(
    (sum, item) => sum + toNumber(item.price) * toNumber(item.quantity),
    0,
  );
};

const normalizeEmail = (email) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase().replace(/\s+/g, "");
};

const getRequestUser = (req, payloadUser = {}) => {
  const email = normalizeEmail(payloadUser?.email || req.user?.email);
  const name = payloadUser?.name || req.user?.name || req.user?.email || "user";
  return { email, name };
};

const getCartEmail = (req, email) => {
  const normalized = normalizeEmail(email || req.user?.email);
  if (!normalized) {
    throw new Error("User email is required");
  }
  return normalized;
};

const addToCart = asyncHandler(async (req, res) => {
  const { product, user } = req.body;

  // console.log(`req.body`, product);

  if (!product.quantity || product.quantity === "" || product.quantity <= 0) {
    res.status(400);
    throw new Error("Please add quantity");
  }

  const businessId = req.business?._id || product?.business;
  const requestUser = getRequestUser(req, user);

  if (!requestUser.email) {
    res.status(400);
    throw new Error("User email is required");
  }

  if (!businessId) {
    res.status(400);
    throw new Error("Business ID is required");
  }
  // console.log(req.body);

  try {
    const resolvedProduct = await Product.findOne({
      _id: req.params.id,
      business: businessId,
    }).lean();

    if (!resolvedProduct) {
      res.status(404);
      throw new Error("Product not found");
    }

    const discountResult = await resolveEffectiveDiscount({
      businessId,
      productId: resolvedProduct._id,
      variantProductId: resolvedProduct._id,
      groupId: resolvedProduct.itemGroup || null,
      basePrice: resolvedProduct.price,
      discountTypes: RECORDED_SALES_DISCOUNT_TYPES,
    });

    const effectiveUnitPrice = Number(discountResult.effectivePrice || resolvedProduct.price || 0);

    let cart = await Cart.findOne({
      business: businessId,
      "user.email": requestUser.email,
    });

    // console.log("got a cart", cart);

    if (cart) {
      //cart exists for user
      // console.log("cart exists for user");
      let itemIndex = cart.items.findIndex((p) => p.id === product._id);

      if (itemIndex > -1) {
        //product exists in the cart, update the quantity
        let productItem = cart.items[itemIndex];
        productItem.quantity = product.quantity;
        productItem.price = effectiveUnitPrice;
        cart.items[itemIndex] = productItem;
      } else {
        //product does not exists in cart, add new item
        cart.items.push({
          id: resolvedProduct._id,
          quantity: product.quantity,
          name: resolvedProduct.name,
          price: effectiveUnitPrice,
          cost: resolvedProduct.cost,
          isProductUnique: resolvedProduct.isProductUnique,
          description: resolvedProduct.description,
          sku: resolvedProduct.sku,
          productIsaGroup: resolvedProduct.productIsaGroup,
          itemGroup: resolvedProduct.itemGroup,
          category: resolvedProduct.category,
          warehouse: resolvedProduct.warehouse,
        });
      }
      cart = await cart.save();

      // console.log("cart saved");
      return res.status(201).json(cart);
    } else {
      //no cart for user, create new cart
      const newCart = await Cart.create({
        business: businessId,
        user: {
          email: requestUser.email,
          name: requestUser.name,
        },
        items: [
          {
            id: resolvedProduct._id,
            quantity: product.quantity,
            name: resolvedProduct.name,
            price: effectiveUnitPrice,
            cost: resolvedProduct.cost,
            isProductUnique: resolvedProduct.isProductUnique,
            description: resolvedProduct.description,
            sku: resolvedProduct.sku,
            productIsaGroup: resolvedProduct.productIsaGroup,
            itemGroup: resolvedProduct.itemGroup,
            category: resolvedProduct.category,
            warehouse: resolvedProduct.warehouse,
          },
        ],
      });

      return res.status(201).json(newCart);
    }
  } catch (err) {
    res.status(500).send("Something went wrong");
  }
});

const getCart = asyncHandler(async (req, res) => {
  try {
    const email = getCartEmail(req, req.params.email);
    const cart = await Cart.findOne({
      business: req.business._id,
      "user.email": email,
    });
    // console.log("email", req.params.email);
    if (cart) {
      return res.status(200).json(cart);
    } else {
      return res.status(200).json({});
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const setPrice = asyncHandler(async (req, res) => {
  let { id, cartId, price, email } = req.body;
  const userEmail = getCartEmail(req, email);

  try {
    let cart = await Cart.findOne({
      business: req.business._id,
      "user.email": userEmail,
    });
    let product = await Product.findOne({ _id: id, business: req.business._id });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == cartId);

      if (itemIndex > -1) {
        //product exists in the cart, update the price
        let productItem = cart.items[itemIndex];
        productItem.price = price;
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }

      cart = await cart.save();

      // Emit cart update event
      eventBus.emitBusinessEvent(
        EventTypes.CART_UPDATED,
        req.business._id.toString(),
        cart,
        {
          type: "price_update",
          source: "inventory-app",
        },
      );

      return res.status(200).json(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw err;
  }
});

const setCartQuantity = asyncHandler(async (req, res) => {
  let { id, cartId, quantity, email } = req.body;
  const userEmail = getCartEmail(req, email);

  try {
    let cart = await Cart.findOne({
      business: req.business._id,
      "user.email": userEmail,
    });
    let product = await Product.findOne({ _id: id, business: req.business._id });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == cartId);

      if (itemIndex > -1) {
        // product exists in the cart, update the quantity (numeric clamp)
        let productItem = cart.items[itemIndex];
        const requested = Math.max(1, Number(quantity) || 1);
        const maxStock = Number(product.quantity) || 0;
        productItem.quantity = Math.min(requested, maxStock);
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }

      cart = await cart.save();
      return res.status(200).json(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw err;
  }
});

const increaseCartItems = asyncHandler(async (req, res) => {
  let { id, cartId, quantity, email } = req.body;
  const userEmail = getCartEmail(req, email);

  try {
    let cart = await Cart.findOne({
      business: req.business._id,
      "user.email": userEmail,
    });
    let product = await Product.findOne({ _id: id, business: req.business._id });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == cartId);

      if (itemIndex > -1) {
        // product exists in the cart, update the quantity (numeric clamp)
        let productItem = cart.items[itemIndex];
        const requested = Math.max(1, Number(quantity) || 1);
        const maxStock = Number(product.quantity) || 0;
        productItem.quantity = Math.min(requested, maxStock);
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }
      cart = await cart.save();

      // Emit cart update event
      eventBus.emitBusinessEvent(
        EventTypes.CART_UPDATED,
        req.business._id.toString(),
        cart,
        {
          type: "quantity_update",
          source: "inventory-app",
        },
      );

      return res.status(201).send(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw err;
  }
});

const decreaseCartitems = asyncHandler(async (req, res) => {
  let { id, cartId, quantity, email } = req.body;
  const userEmail = getCartEmail(req, email);

  try {
    let cart = await Cart.findOne({
      business: req.business._id,
      "user.email": userEmail,
    });
    let product = await Product.findOne({ _id: id, business: req.business._id });

    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == cartId);

      if (itemIndex > -1) {
        // product exists in the cart, update the quantity (min 1)
        let productItem = cart.items[itemIndex];
        const requested = Math.max(1, Number(quantity) || 1);
        const maxStock = Number(product.quantity) || 0;
        productItem.quantity = Math.min(requested, maxStock);
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }
      cart = await cart.save();

      // Emit cart update event
      eventBus.emitBusinessEvent(
        EventTypes.CART_UPDATED,
        req.business._id.toString(),
        cart,
        {
          type: "quantity_update",
          source: "inventory-app",
        },
      );

      return res.status(201).send(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }
    throw err;
  }
});

// Delete Product
const deleteCartItem = asyncHandler(async (req, res) => {
  const { id } = req.params; // to be updated
  try {
    const userEmail = getCartEmail(req, req.query.email);
    let cart = await Cart.findOne({
      business: req.business._id,
      "user.email": userEmail,
    });

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == id);

      if (itemIndex > -1) {
        //item exists in the store, update the quantity
        let productItem = cart.items[itemIndex];

        await productItem.remove();
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }
      cart = await cart.save();
      return res.status(201).json(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    res.status(500).send("Something went wrong");
  }
});

const checkoutCart = asyncHandler(async (req, res) => {
  const { items, customer, user, paymentDetails, deliveryStatus } = req.body;
  // To be updated
  // console.log("deliveryStatus", deliveryStatus);

  if (!customer.name) {
    return res.status(404).json({ message: "Please enter customer's name" });
  }

  const requestUser = getRequestUser(req, user);
  if (!requestUser.email) {
    return res.status(400).json({ message: "User email is required" });
  }

  try {
    let cart = await Cart.findOneAndUpdate(
      {
        business: req.business._id,
        "user.email": requestUser.email,
        checkoutInProgress: { $ne: true },
        "items.0": { $exists: true },
      },
      {
        $set: {
          checkoutInProgress: true,
          checkoutStartedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!cart) {
      const existingCart = await Cart.findOne({
        business: req.business._id,
        "user.email": requestUser.email,
      });

      if (!existingCart) {
        return res.status(404).json({ message: "Cannot find cart" });
      }

      if (existingCart.checkoutInProgress) {
        return res.status(409).json({ message: "Checkout already processing" });
      }

      if (!existingCart.items || existingCart.items.length === 0) {
        return res
          .status(400)
          .json({ message: "Cart is empty or already checked out" });
      }

      return res.status(409).json({ message: "Checkout already processing" });
    }

    if (cart && cart.items.length > 0) {
      // First pass: deduct quantities and track for history
      const singleProductsToUpdate = [];
      const groupProductsToUpdate = [];

      for (const item of cart.items) {
        try {
          let itemIndex = cart.items.findIndex((p) => p._id == item._id);
          // check that item exists in cart

          if (itemIndex > -1) {
            let productItem = cart.items[itemIndex];
            let product = await Product.findOne({ _id: productItem.id });

            if (product) {
              if (Number(product.quantity) < Number(productItem.quantity)) {
                return res
                  .status(400)
                  .json({ message: "Not enough product in stock" });
              }

              const quantitySold = Number(productItem.quantity);
              const oldQuantity = Number(product.quantity);
              product.quantity = oldQuantity - quantitySold;

              const remainingQuantity = product.quantity;

              // Initialize history if it doesn't exist
              if (!product.history) {
                product.history = [];
                product.totalStocked = 0;
                product.totalSold = 0;
                product.totalRevenue = 0;
              }

              // Add sale history entry
              const salePrice = Number(productItem.price) || product.price;
              const historyEntry = {
                date: new Date(),
                type: "sale",
                quantityChange: -quantitySold,
                balance: product.quantity,
                performedBy:
                  (user && (user.email || user.name)) ||
                  (req.user && (req.user.email || req.user.name)) ||
                  "system",
                note: "",
                amount: salePrice,
              };
              product.history.push(historyEntry);

              if (product.productIsaGroup && product.isProductUnique) {
                if (!product.itemGroup) {
                  throw new Error("Product group reference missing");
                }
                const productGroup = await ProductGroup.findById(
                  product.itemGroup,
                );
                if (productGroup) {
                  if (!productGroup.history) {
                    productGroup.history = [];
                    productGroup.totalStocked = 0;
                    productGroup.totalSold = 0;
                    productGroup.totalRevenue = 0;
                  }

                  // Add history entry for group
                  const groupHistoryEntry = {
                    date: new Date(),
                    type: "sale",
                    itemName: product.name,
                    quantityChange: -quantitySold,
                    balance: product.quantity,
                    performedBy:
                      (user && (user.name || user.email)) ||
                      (req.user && (req.user.name || req.user.email)) ||
                      "system",
                    note: "",
                    amount: Number(product.price) || 0,
                  };
                  productGroup.history.push(groupHistoryEntry);
                  groupProductsToUpdate.push(productGroup);
                }

                await removeFromCombined(product);
                await updateProductGroup(product);
                if (remainingQuantity <= 0) {
                  const removedProductId = product._id.toString();
                  await product.remove();
                  eventBus.emitBusinessEvent(
                    EventTypes.PRODUCT_DELETED,
                    req.business._id.toString(),
                    { _id: removedProductId, productId: removedProductId },
                    { source: "checkout", reason: "sold_out_unique" },
                  );
                } else {
                  singleProductsToUpdate.push(product);
                }
              } else if (product.productIsaGroup && !product.isProductUnique) {
                const productGroup = await ProductGroup.findById(
                  product.itemGroup,
                );
                if (productGroup) {
                  if (!productGroup.history) {
                    productGroup.history = [];
                    productGroup.totalStocked = 0;
                    productGroup.totalSold = 0;
                    productGroup.totalRevenue = 0;
                  }

                  const productIndex = productGroup.combinations.findIndex(
                    (comb) => comb === product.name,
                  );

                  if (productIndex > -1) {
                    productGroup.quantity[productIndex] =
                      Number(productGroup.quantity[productIndex]) -
                      quantitySold;

                    // Add history entry for group non-unique item
                    const groupHistoryEntry = {
                      date: new Date(),
                      type: "sale",
                      itemName: `${product.name}`,
                      quantityChange: -quantitySold,
                      balance: Number(productGroup.quantity[productIndex]),
                      performedBy:
                        (user && (user.name || user.email)) ||
                        (req.user && (req.user.name || req.user.email)) ||
                        "system",
                      note: "",
                      amount: Number(product.price) || 0,
                    };
                    productGroup.history.push(groupHistoryEntry);
                    groupProductsToUpdate.push(productGroup);
                  }
                }
                singleProductsToUpdate.push(product);
              } else {
                singleProductsToUpdate.push(product);
              }
            } else {
              return res
                .status(404)
                .json({ message: "Product is not in the cart" });
            }
          }
        } catch (error) {
          return res.status(404).json({ message: error.message });
        }
      }

      // Save all products with history updates
      for (const product of singleProductsToUpdate) {
        await product.save();
        // Update sales metrics for every product (including group variants)
        await updateProductSalesMetrics(product._id.toString());
      }

      // Save all product groups and update their metrics
      for (const productGroup of groupProductsToUpdate) {
        await productGroup.save();
        await updateGroupSalesMetrics(productGroup._id.toString());
      }

      const orderId = generateOrderId(req.business.businessName);

      // Normalize payment for single or split methods
      const incomingPayment = paymentDetails || {};
      let paymentTypes = Array.isArray(incomingPayment.paymentTypes)
        ? incomingPayment.paymentTypes.filter(Boolean)
        : [];

      if (paymentTypes.length === 0 && incomingPayment.paymentType) {
        paymentTypes = incomingPayment.paymentType
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean);
      }

      let paymentAmounts = incomingPayment.paymentAmounts || {};
      const explicitPartAmount = toNumber(
        incomingPayment?.partPaymentDetails?.amountPaid ||
          incomingPayment?.paymentDetails?.amountPaid,
      );
      const hasBreakdown =
        paymentAmounts && Object.keys(paymentAmounts).length > 0;

      // Backward compatibility: if only one method selected and no breakdown, assume full amount on that method
      if (!hasBreakdown && paymentTypes.length === 1 && !explicitPartAmount) {
        paymentAmounts = {
          [paymentTypes[0]]: computeTotalOrderCost(cart.items),
        };
      }

      // Ensure numeric amounts and include known methods
      const paymentAmountsNormalized = {
        cash: toNumber(paymentAmounts.cash),
        transfer: toNumber(paymentAmounts.transfer),
        pos: toNumber(paymentAmounts.pos),
      };

      paymentTypes.forEach((method) => {
        if (!(method in paymentAmountsNormalized)) {
          paymentAmountsNormalized[method] = toNumber(paymentAmounts[method]);
        }
      });

      const paymentSum = Object.values(paymentAmountsNormalized).reduce(
        (sum, val) => sum + toNumber(val),
        0,
      );

      const amountPaid = paymentSum > 0 ? paymentSum : explicitPartAmount;

      // Allow 0 only when part payment is selected
      const partSelected =
        (incomingPayment?.paymentType || "").toLowerCase().includes("part") ||
        incomingPayment?.paymentStatus === "pending";
      if (!amountPaid && !partSelected) {
        return res
          .status(400)
          .json({ message: "Please provide the amount paid" });
      }

      const totalOrderCost = computeTotalOrderCost(cart.items);
      const balance = Math.max(totalOrderCost - amountPaid, 0);
      const isPending = balance > 0;

      const paymentParts = [];
      paymentTypes.forEach((method) => {
        const value = toNumber(paymentAmountsNormalized[method]);
        if (value > 0) {
          paymentParts.push({
            amountPaid: value,
            method,
            datePaid: new Date(),
          });
        }
      });

      if (paymentParts.length === 0 && amountPaid > 0) {
        paymentParts.push({
          amountPaid,
          method:
            paymentTypes[0] || incomingPayment.paymentType || "unspecified",
          datePaid: new Date(),
        });
      }

      const paymentPayload = {
        paymentType: isPending
          ? "part"
          : incomingPayment.paymentType || paymentTypes.join(",") || "cash",
        paymentTypes,
        paymentAmounts: paymentAmountsNormalized,
        paymentStatus: isPending ? "pending" : "completed",
        paymentDetails: {
          amountPaid,
          balance,
          paymentParts,
        },
      };

      const checkOut = await CheckOut.create({
        business: req.business._id,
        items: [...cart.items],
        customer: { ...customer },
        user: { ...requestUser },
        deliveryStatus: deliveryStatus,
        payment: paymentPayload,
        orderId: orderId,
        totalOrderCost,
      });

      cart.items = [];
      cart.checkoutInProgress = false;
      cart.checkoutStartedAt = null;
      cart.lastCheckoutAt = new Date();
      cart.lastCheckoutId = checkOut?._id?.toString() || "";
      cart = await cart.save();

      // log activity with details
      const totalItems = checkOut.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const activity = `Completed checkout for order #${orderId} with ${totalItems} item(s), total amount ₦${totalOrderCost.toLocaleString()}, payment: ${
        checkOut.payment?.paymentType || "N/A"
      }, delivery: ${deliveryStatus?.status || "N/A"}${
        checkOut.customer ? ` for customer ${checkOut.customer.name}` : ""
      }`;
      logActivity(activity)(req, res);

      // Emit events for real-time updates
      eventBus.emitBusinessEvent(
        EventTypes.CHECKOUT_COMPLETED,
        req.business._id.toString(),
        {
          checkout: checkOut,
          sale: checkOut,
          items: checkOut.items,
          customer: checkOut.customer,
        },
        { source: "checkout" },
      );

      // Emit product update events for each item
      for (const item of checkOut.items) {
        const productId = item.id;
        if (productId) {
          const updatedProduct = await Product.findOne({
            _id: productId,
            business: req.business._id,
          });
          if (updatedProduct) {
            eventBus.emitBusinessEvent(
              EventTypes.PRODUCT_UPDATED,
              req.business._id.toString(),
              updatedProduct,
              { source: "checkout" },
            );
          }
        }
      }

      return res.status(201).json({ checkOut, cart });
    } else {
      return res.status(404).json({ message: "Cannot find cart" });
    }
  } catch (err) {
    if (err?.message && err.message.includes("User email is required")) {
      return res.status(400).json({ message: err.message });
    }
    if (req.business?._id && requestUser?.email) {
      await Cart.updateOne(
        { business: req.business._id, "user.email": requestUser.email },
        { $set: { checkoutInProgress: false, checkoutStartedAt: null } },
      );
    }
    return res.status(404).json({ message: err.message });
  }
});

const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;

  try {
    const checkOut = await CheckOut.findById(id);

    if (!checkOut) {
      return res.status(404).json({ message: "Checkout not found" });
    }

    const oldStatus = checkOut.deliveryStatus.status;
    checkOut.deliveryStatus.status = status;
    checkOut.deliveryStatus.date = new Date();

    // log activity
    const activity = `Updated delivery status for order #${
      checkOut.orderId
    } from "${oldStatus}" to "${status}"${
      checkOut.customer ? ` for customer ${checkOut.customer.name}` : ""
    }`;
    logActivity(activity)(req, res);

    await checkOut.save();

    // Emit realtime event so other connected clients update in-place
    const businessId = req.business?._id || req.business?.id;
    if (businessId) {
      eventBus.emitBusinessEvent(
        EventTypes.CHECKOUT_COMPLETED,
        businessId.toString(),
        {
          _id: checkOut._id,
          checkout: checkOut,
          sale: checkOut,
        },
        {
          source: "delivery_status_update",
          type: "payment_update",
        },
      );
    }

    return res.status(200).json(checkOut);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// get all checkouts
const getCheckOuts = asyncHandler(async (req, res) => {
  let filter = { business: req.business._id };
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";

  // Parse filter parameters
  const categoryFilter = req.query.category
    ? JSON.parse(req.query.category)
    : [];
  const warehouseFilter = req.query.warehouse
    ? JSON.parse(req.query.warehouse)
    : [];
  const priceRangeFilter = req.query.priceRange
    ? JSON.parse(req.query.priceRange)
    : [];

  let startDate, endDate;
  const now = new Date();

  // Only apply date filter if start/end are provided AND not empty strings
  const hasStartDate =
    req.query.start &&
    req.query.start !== "" &&
    req.query.start !== "undefined";
  const hasEndDate =
    req.query.end && req.query.end !== "" && req.query.end !== "undefined";

  if (hasStartDate || hasEndDate) {
    // If start is a number, treat it as "days ago"
    if (hasStartDate && !isNaN(req.query.start)) {
      const daysAgo = parseInt(req.query.start);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      endDate = now;
    }
    // If both start and end are provided, use them as date strings
    else if (hasStartDate && hasEndDate) {
      startDate = new Date(req.query.start);
      endDate = new Date(req.query.end);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
    // If only one is provided, default to current month
    else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    // Apply the date filter
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }
  // If neither start nor end provided (both empty strings), NO date filter - return ALL sales

  // Add search filter
  if (search) {
    filter.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
      { "items.name": { $regex: search, $options: "i" } },
    ];
  }

  // Add category filter - checkout must have at least one item matching any of the categories
  if (categoryFilter.length > 0) {
    filter["items.category"] = { $in: categoryFilter };
  }

  // Add warehouse filter - checkout must have at least one item matching any of the warehouses
  if (warehouseFilter.length > 0) {
    filter["items.warehouse"] = { $in: warehouseFilter };
  }

  // Add price range filter - this needs to be handled with aggregation for accuracy
  // For now, we'll apply it post-query to avoid complexity
  let priceFilter = null;
  if (priceRangeFilter.length > 0) {
    priceFilter = priceRangeFilter;
  }

  // Get checkouts with filters
  let checkOuts = await CheckOut.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(priceFilter ? limit * 3 : limit); // Fetch more if price filtering needed

  // Apply price range filter if specified
  if (priceFilter) {
    checkOuts = checkOuts.filter((checkout) =>
      checkout.items.some((item) => {
        const price = parseFloat(item.price) || 0;
        return priceFilter.some((range) => {
          switch (range) {
            case "0-1000":
              return price >= 0 && price <= 1000;
            case "1000-5000":
              return price > 1000 && price <= 5000;
            case "5000-10000":
              return price > 5000 && price <= 10000;
            case "10000+":
              return price > 10000;
            default:
              return true;
          }
        });
      }),
    );
    // Trim to actual page size after filtering
    checkOuts = checkOuts.slice(0, limit);
  }

  // Get total count (including price filter if applicable)
  let total;
  if (priceFilter) {
    // For price filtering, we need to get all matching docs and count
    const allMatchingDocs = await CheckOut.find(filter).sort({ createdAt: -1 });
    const filteredDocs = allMatchingDocs.filter((checkout) =>
      checkout.items.some((item) => {
        const price = parseFloat(item.price) || 0;
        return priceFilter.some((range) => {
          switch (range) {
            case "0-1000":
              return price >= 0 && price <= 1000;
            case "1000-5000":
              return price > 1000 && price <= 5000;
            case "5000-10000":
              return price > 5000 && price <= 10000;
            case "10000+":
              return price > 10000;
            default:
              return true;
          }
        });
      }),
    );
    total = filteredDocs.length;
  } else {
    total = await CheckOut.countDocuments(filter);
  }

  // Calculate aggregated statistics using MongoDB aggregation for better performance
  const aggregationPipeline = [
    { $match: filter },
    {
      $addFields: {
        // Calculate grandTotal from items
        grandTotal: {
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $multiply: [
                  { $toDouble: { $ifNull: ["$$item.price", 0] } },
                  { $toInt: { $ifNull: ["$$item.quantity", 0] } },
                ],
              },
            },
          },
        },
        // Calculate profit from items (price - cost) * quantity
        profit: {
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $multiply: [
                  {
                    $subtract: [
                      { $toDouble: { $ifNull: ["$$item.price", 0] } },
                      { $toDouble: { $ifNull: ["$$item.cost", 0] } },
                    ],
                  },
                  { $toInt: { $ifNull: ["$$item.quantity", 0] } },
                ],
              },
            },
          },
        },
        // Get payment method from nested payment.paymentType
        paymentMethod: "$payment.paymentType",
        cashAmount: {
          $toDouble: { $ifNull: ["$payment.paymentAmounts.cash", 0] },
        },
        transferAmount: {
          $toDouble: { $ifNull: ["$payment.paymentAmounts.transfer", 0] },
        },
        posAmount: {
          $toDouble: { $ifNull: ["$payment.paymentAmounts.pos", 0] },
        },
        // Get payment status from nested payment.paymentStatus
        paymentStatus: "$payment.paymentStatus",
        // Get amount paid from nested payment.paymentDetails.amountPaid
        amountPaid: { $ifNull: ["$payment.paymentDetails.amountPaid", 0] },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$grandTotal" },
        totalProfit: { $sum: "$profit" },
        totalItems: { $sum: { $size: { $ifNull: ["$items", []] } } },
        totalCash: {
          $sum: {
            $cond: [
              { $gt: ["$cashAmount", 0] },
              "$cashAmount",
              {
                $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$grandTotal", 0],
              },
            ],
          },
        },
        totalTransfer: {
          $sum: {
            $cond: [
              { $gt: ["$transferAmount", 0] },
              "$transferAmount",
              {
                $cond: [
                  { $eq: ["$paymentMethod", "transfer"] },
                  "$grandTotal",
                  0,
                ],
              },
            ],
          },
        },
        totalPOS: {
          $sum: {
            $cond: [
              { $gt: ["$posAmount", 0] },
              "$posAmount",
              {
                $cond: [{ $eq: ["$paymentMethod", "pos"] }, "$grandTotal", 0],
              },
            ],
          },
        },
        partPayments: {
          $push: {
            $cond: [
              { $eq: ["$paymentStatus", "Part Payment"] },
              {
                grandTotal: "$grandTotal",
                amountPaid: "$amountPaid",
                profit: "$profit",
              },
              "$$REMOVE",
            ],
          },
        },
      },
    },
  ];

  const aggregationResult = await CheckOut.aggregate(aggregationPipeline);

  // Debug: Log aggregation result
  // console.log('Aggregation pipeline filter:', JSON.stringify(filter));
  // console.log('Aggregation result:', JSON.stringify(aggregationResult));

  let aggregatedStats = {
    totalSales: 0,
    totalProfit: 0,
    totalCash: 0,
    totalTransfer: 0,
    totalPOS: 0,
    totalPending: 0,
    totalPendingProfit: 0,
    totalItems: 0,
  };

  if (aggregationResult.length > 0) {
    const result = aggregationResult[0];
    aggregatedStats.totalSales = result.totalSales || 0;
    aggregatedStats.totalProfit = result.totalProfit || 0;
    aggregatedStats.totalCash = result.totalCash || 0;
    aggregatedStats.totalTransfer = result.totalTransfer || 0;
    aggregatedStats.totalPOS = result.totalPOS || 0;
    aggregatedStats.totalItems = result.totalItems || 0;

    // Calculate pending amounts from part payments
    if (result.partPayments && result.partPayments.length > 0) {
      result.partPayments.forEach((payment) => {
        const pendingAmount = payment.grandTotal - payment.amountPaid;
        aggregatedStats.totalPending += pendingAmount;

        // Calculate pending profit proportionally
        const paidRatio = payment.amountPaid / payment.grandTotal;
        aggregatedStats.totalPendingProfit += payment.profit * (1 - paidRatio);
      });
    }
  }

  // console.log('Final aggregatedStats:', aggregatedStats);

  res.status(200).json({
    checkouts: checkOuts,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
    aggregatedStats,
  });
});

// get all checkouts by user/business
const getAllCheckOuts = asyncHandler(async (req, res) => {
  let filter = { business: req.business._id };
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await CheckOut.countDocuments(filter);
  const allCheckOuts = await CheckOut.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    checkOuts: allCheckOuts,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
  });
});

// Get unique years from all checkouts
const getCheckoutYears = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business._id;

    // Get all distinct years from checkouts
    const years = await CheckOut.aggregate([
      { $match: { business: businessId } },
      {
        $group: {
          _id: { $year: "$createdAt" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const uniqueYears = years.map((item) => item._id);

    res.status(200).json({
      years: uniqueYears,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/* generate receipt */
const generateReceipt = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const checkOut = await CheckOut.findOne({ _id: id });

    if (checkOut.receipt === undefined) {
      // console.log("we're here", checkOut);

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

    if (checkOut.receipt) {
      const readStream = getFileStream(`${checkOut._id}.pdf`);

      res.attachment(`${checkOut._id}.pdf`);
      readStream.pipe(res);
    } else {
      res.status(404).json({ message: "Receipt not found" });
    }
  } catch (error) {
    console.error("Error generating receipt:", error);
    res
      .status(500)
      .json({ message: "An error occurred while generating the receipt" });
  }
});

// send receipt to customer via whatsapp
const sendReceipt = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const checkOut = await CheckOut.findOne({ _id: id });

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

    if (checkOut.receipt) {
      const data = getTemplatedMessageInput(
        process.env.RECIPIENT_WAID,
        checkOut.receipt,
      );

      sendMessage(data)
        .then(function (response) {
          res.status(200).json(response.data);
          // sendSMS("+2348065109764", `Your receipt has been sent to your SMS`);
        })
        .catch(function (error) {
          console.log("something went wrong", error);
        });
    } else {
      res.status(404).json({ message: "Receipt not found" });
    }
  } catch (error) {
    console.error("Error generating receipt:", error);
    res
      .status(500)
      .json({ message: "An error occurred while sending the receipt" });
  }
});

// send receipt directly to printer for printing. such as thermal printer
const sendReceiptToPrinter = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const checkOut = await CheckOut.findOne({ _id: id });

    if (!checkOut.receipt) {
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

    if (checkOut.receipt) {
      const readStream = getFileStream(`${checkOut._id}.pdf`);

      res.attachment(`${checkOut._id}.pdf`);
      readStream.pipe(res);

      printReceipt(checkOut)
        .then(function (response) {
          res
            .status(200)
            .json({ response: "Receipt sent to printer successfully!" });
        })
        .catch(function (error) {
          return res.status(400).json({ message: error.message });
        });
    } else {
      res.status(404).json({ message: "Receipt not found" });
    }
  } catch (error) {
    console.error("Error generating receipt:", error);
    res
      .status(500)
      .json({ message: "An error occurred while printing the receipt" });
  }
});

const returnItemSold = asyncHandler(async (req, res) => {
  const checkoutId = req.params.id;
  const formData = req.body;

  try {
    const checkout = await CheckOut.findOne({
      business: req.business._id,
      _id: checkoutId,
    });

    if (!checkout) {
      return res.status(404).json({ message: "Checkout not found" });
    }

    if (formData.itemsToReturn.length === 0) {
      return res.status(400).json({ message: "No items to return" });
    }

    const itemsToProcess = formData.itemsToReturn;
    const productUpdates = [];
    const createdProductPromises = [];
    const productGroupUpdates = [];
    const productUpdateIds = new Set();
    const productGroupIds = new Set();

    let totalRefund = 0;

    for (const item of itemsToProcess) {
      if (!item.productIsaGroup) {
        const product = await Product.findOne({
          business: req.business._id,
          _id: item.id,
        });

        if (product) {
          const itemExists = checkout.items.some(
            (checkoutItem) =>
              checkoutItem._id.toString() === item._id.toString(),
          );

          if (itemExists) {
            product.quantity = Number(product.quantity) + Number(item.quantity);
            productUpdates.push(product.save());
            productUpdateIds.add(product._id.toString());
            checkout.items = checkout.items.filter(
              (checkoutItem) =>
                checkoutItem._id.toString() !== item._id.toString(),
            );
            totalRefund += item.price * item.quantity;
          } else {
            throw new Error("Item does not exist in the checkout");
          }
        } else {
          return res
            .status(404)
            .json({ message: `Product with id ${item.id} not found` });
        }
      } else {
        const productGroup = await ProductGroup.findById(item.itemGroup);

        if (productGroup) {
          if (item.productIsaGroup && !item.isProductUnique) {
            if (productGroup) {
              const productIndex = productGroup.combinations.findIndex(
                (comb) => comb === item.name,
              );

              const product = await Product.findOne({
                business: req.business._id,
                _id: item.id,
                itemGroup: item.itemGroup,
              });

              // console.log("product", product);

              if (product) {
                product.quantity =
                  Number(product.quantity) + Number(item.quantity);
                productUpdates.push(product.save());
                productUpdateIds.add(product._id.toString());
              }

              if (productIndex > -1) {
                productGroup.quantity[productIndex] =
                  Number(productGroup.quantity[productIndex]) +
                  Number(item.quantity);
                checkout.items = checkout.items.filter(
                  (checkoutItem) =>
                    checkoutItem._id.toString() !== item._id.toString(),
                );
                await checkout.save();
                // Emit event for real-time fulfilment updates
                eventBus.emitBusinessEvent(
                  EventTypes.CHECKOUT_COMPLETED,
                  req.business._id.toString(),
                  {
                    checkout,
                    sale: checkout,
                    items: checkout.items,
                    customer: checkout.customer,
                  },
                  {
                    source: "return",
                    type: "payment_update",
                  },
                );

                await productGroup.save();
                if (productGroup?._id) {
                  productGroupIds.add(productGroup._id.toString());
                }
                totalRefund += item.price * item.quantity;
              }
            }
          }

          if (item.productIsaGroup && item.isProductUnique) {
            const combination = item.name.split("-");

            const options = combination[1].trim().split("/");

            productGroup.sku.push(item.sku);
            productGroup.cost.push(item.cost);
            productGroup.price.push(item.price);
            productGroup.warehouse.push(item.warehouse);
            productGroup.quantity.push(item.quantity);
            productGroup.combinations.push(item.name);

            const update = {};

            productGroup.options.forEach((optionGroup, optionGroupIndex) => {
              const option = options[optionGroupIndex];
              if (optionGroup) {
                optionGroup.attr.push({ value: option, showInput: false });
                update[`options.${optionGroupIndex}.attr`] = optionGroup.attr;
              }
            });

            const updatedProductGroup = await ProductGroup.findByIdAndUpdate(
              item.itemGroup,
              { $set: update },
              { new: true },
            );

            await productGroup.save();
            productGroupUpdates.push(updatedProductGroup);
            if (updatedProductGroup?._id) {
              productGroupIds.add(updatedProductGroup._id.toString());
            }

            const newProduct = new Product({
              business: req.business._id,
              productIsaGroup: true,
              isProductUnique: item.isProductUnique,
              itemGroup: productGroup._id,
              name: item.name,
              sku: item.sku,
              warehouse: item.warehouse,
              category: productGroup.category,
              quantity: item.quantity,
              cost: item.cost,
              price: item.price,
              description: productGroup.description,
            });

            createdProductPromises.push(newProduct.save());

            checkout.items = checkout.items.filter(
              (checkoutItem) =>
                checkoutItem._id.toString() !== item._id.toString(),
            );
            await checkout.save();
            totalRefund += item.price * item.quantity;
          }
        } else {
          console.log(`Product group with id ${item.itemGroup} not found`);
        }
      }
    }

    const createdProducts = await Promise.all(createdProductPromises);
    await Promise.all([...productUpdates, ...productGroupUpdates]);

    if (checkout.payment.paymentType === "part") {
      checkout.payment.paymentDetails.balance -= totalRefund;
      if (checkout.payment.paymentDetails.balance <= 0) {
        checkout.payment.paymentStatus = "completed";
        checkout.payment.paymentDetails.balance = 0;
      } else {
        checkout.payment.paymentStatus = "pending";
      }
    }

    if (checkout.items.length === 0) {
      await CheckOut.findByIdAndRemove(checkoutId);

      // Emit event for checkout removal when all items are returned
      eventBus.emitBusinessEvent(
        EventTypes.SALE_REFUNDED,
        req.business._id.toString(),
        {
          checkoutId: checkoutId,
          status: "removed",
          reason: "all_items_returned",
          totalRefund: totalRefund,
          checkout: null, // Checkout no longer exists
        },
        { source: "return", action: "checkout_deleted" },
      );
    } else {
      await checkout.save();

      // Emit event for partial return with updated checkout
      eventBus.emitBusinessEvent(
        EventTypes.SALE_REFUNDED,
        req.business._id.toString(),
        {
          checkoutId: checkoutId,
          status: "updated",
          reason: "partial_items_returned",
          totalRefund: totalRefund,
          checkout: checkout,
          updatedItems: checkout.items,
        },
        { source: "return", action: "items_returned" },
      );
    }

    // Emit product update events for all returned items
    for (const productId of productUpdateIds) {
      const product = await Product.findOne({
        _id: productId,
        business: req.business._id,
      });
      if (product) {
        eventBus.emitBusinessEvent(
          EventTypes.PRODUCT_UPDATED,
          req.business._id.toString(),
          product,
          { source: "return", action: "quantity_restored" },
        );
      }
    }

    // Emit product created events for restored unique variants
    if (createdProducts.length > 0) {
      eventBus.emitBusinessEvent(
        EventTypes.PRODUCT_CREATED,
        req.business._id.toString(),
        { products: createdProducts },
        { source: "return", action: "product_recreated" },
      );
    }

    // Emit product group update events (skip product cache reset on client)
    for (const groupId of productGroupIds) {
      const group = await ProductGroup.findById(groupId);
      if (group) {
        eventBus.emitBusinessEvent(
          EventTypes.PRODUCT_GROUP_UPDATED,
          req.business._id.toString(),
          group,
          {
            source: "return",
            action: "group_updated",
            skipProductCacheReset: true,
          },
        );
      }
    }

    // log activity
    const itemReturned = itemsToProcess.map((item) => {
      return `${item.quantity} ${item.name}`;
    });
    const activity = `returned ${itemReturned.join(", ")} from order ${
      checkout.orderId
    }`;
    logActivity(activity)(req, res);

    const checkouts = await CheckOut.find({ business: req.business._id });
    res.status(200).json(checkouts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error returning items" });
  }
});

const getCustomers = asyncHandler(async (req, res) => {
  const checkouts = await CheckOut.find({ business: req.business._id });

  let customers = checkouts.map((checkout) => checkout.customer);

  const uniqueCustomers = customers.filter(
    (customer, index, self) =>
      index ===
      self.findIndex(
        (c) =>
          c.name === customer.name &&
          c.email === customer.email &&
          c.phone === customer.phone,
      ),
  );

  // console.log("uniqueCustomers", uniqueCustomers);

  res.status(200).json(uniqueCustomers);
});

const getIncompletePayments = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || ""; // 'pending' or 'completed'
    const category = req.query.category ? req.query.category.split(",") : [];
    const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];
    const priceRange = req.query.priceRange
      ? req.query.priceRange.split(",")
      : [];
    const skip = (page - 1) * limit;

    let filter = {
      business: req.business._id,
      "payment.paymentType": "part",
      createdAt: { $lte: new Date() },
    };

    // Add status filter
    if (status) {
      filter["payment.paymentStatus"] = status;
    }

    // Add search filter
    if (search) {
      filter.$or = [
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
        { "customer.email": { $regex: search, $options: "i" } },
      ];
    }

    // Add category filter (searching in items array)
    if (category.length > 0) {
      filter["items.category"] = { $in: category };
    }

    // Add warehouse filter (searching in items array)
    if (warehouse.length > 0) {
      filter["items.warehouse"] = { $in: warehouse };
    }

    // Add price range filter
    if (priceRange.length > 0) {
      const priceConditions = [];
      priceRange.forEach((range) => {
        if (range === "0-50") {
          priceConditions.push({
            "payment.paymentDetails.balance": { $gte: 0, $lte: 50 },
          });
        } else if (range === "50-100") {
          priceConditions.push({
            "payment.paymentDetails.balance": { $gte: 50, $lte: 100 },
          });
        } else if (range === "100-500") {
          priceConditions.push({
            "payment.paymentDetails.balance": { $gte: 100, $lte: 500 },
          });
        } else if (range === "500+") {
          priceConditions.push({
            "payment.paymentDetails.balance": { $gte: 500 },
          });
        }
      });
      if (priceConditions.length > 0) {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: priceConditions });
      }
    }

    const total = await CheckOut.countDocuments(filter);
    const checkouts = await CheckOut.find(filter)
      .sort("-createdAt") // Sort by newest first
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      incompletePayments: checkouts, // Changed from 'checkouts' to match frontend expectation
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      hasMore: page * limit < total,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const updateIncompletePayment = asyncHandler(async (req, res) => {
  const { id, amountPaid, method } = req.body;

  try {
    const checkout = await CheckOut.findById(id);

    // console.log("checkout", checkout.payment)

    if (!checkout) {
      return res.status(404).json({ message: "Checkout session not found" });
    }

    if (!checkout.payment) {
      return res
        .status(400)
        .json({ message: "This item does not have a payment" });
    }

    if (!checkout.payment.paymentDetails) {
      checkout.payment.paymentDetails = {
        amountPaid: 0,
        balance: 0,
        paymentParts: [],
      };
    }

    if (!Array.isArray(checkout.payment.paymentDetails.paymentParts)) {
      checkout.payment.paymentDetails.paymentParts = [];
    }

    // Add the new payment part
    checkout.payment?.paymentDetails.paymentParts.push({
      amountPaid: Number(amountPaid),
      method,
      datePaid: new Date(),
    });

    // Calculate the new total amount paid
    const totalAmountPaid =
      checkout?.payment?.paymentDetails.paymentParts.reduce(
        (total, part) => total + Number(part.amountPaid),
        0,
      );

    // Update paymentAmounts by aggregating all paymentParts by method
    if (!checkout.payment.paymentAmounts) {
      checkout.payment.paymentAmounts = {
        cash: 0,
        transfer: 0,
        pos: 0,
      };
    }

    // Aggregate all paymentParts by method to calculate accurate totals
    checkout.payment.paymentAmounts = {
      cash: 0,
      transfer: 0,
      pos: 0,
    };

    checkout.payment.paymentDetails.paymentParts.forEach((part) => {
      if (part.method in checkout.payment.paymentAmounts) {
        checkout.payment.paymentAmounts[part.method] += Number(part.amountPaid);
      }
    });

    // Calculate the total cost of items including quantity
    const totalCost = computeTotalOrderCost(checkout?.items);

    // console.log("Total cost:", totalCost);
    // console.log("Total amount paid:", totalAmountPaid);

    // Update the amountPaid and balance
    if (checkout.payment) {
      checkout.payment.paymentDetails.amountPaid = totalAmountPaid;
      checkout.payment.paymentDetails.balance = Math.max(
        totalCost - totalAmountPaid,
        0,
      );
      checkout.payment.paymentType =
        checkout.payment.paymentDetails.balance > 0
          ? "part"
          : checkout.payment.paymentType;
    }

    // console.log(`New Balance: ${checkout?.payment?.paymentDetails?.balance}`);

    // Check if the payment is completed
    if (checkout?.payment?.paymentDetails?.balance <= 0) {
      checkout.payment.paymentStatus = "completed";
      checkout.payment.paymentDetails.balance = 0; // Ensure balance is exactly 0 if fully paid
    } else if (checkout?.payment) {
      checkout.payment.paymentStatus = "pending";
    } else {
      return res
        .status(400)
        .json({ message: "This item does not have a payment" });
    }

    await checkout.save();

    // Emit event for real-time fulfilment updates after payment
    eventBus.emitBusinessEvent(
      EventTypes.CHECKOUT_COMPLETED,
      req.business._id.toString(),
      {
        checkout: checkout,
      },
      { type: "payment_update", source: "updateIncompletePayment" },
    );

    // log activity to include the amount paid with context
    const orderTotalCost =
      checkout.totalOrderCost || computeTotalOrderCost(checkout.items);
    const newTotalPaid = totalAmountPaid;
    const remainingBalance = Math.max(orderTotalCost - newTotalPaid, 0);
    const activity = `Updated payment for order #${
      checkout.orderId
    }: received ₦${parseFloat(
      amountPaid,
    ).toLocaleString()}, total paid: ₦${newTotalPaid.toLocaleString()} of ₦${orderTotalCost.toLocaleString()}${
      remainingBalance > 0
        ? `, balance: ₦${remainingBalance.toLocaleString()}`
        : " (fully paid)"
    }`;
    logActivity(activity)(req, res);

    // Return paginated results after update
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      business: req.business._id,
      "payment.paymentType": "part",
      createdAt: { $lte: new Date() },
    };

    const total = await CheckOut.countDocuments(filter);
    const checkouts = await CheckOut.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      checkouts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// const updateOrderIds = asyncHandler(async (req, res) => {
//   try {
//     const checkouts = await CheckOut.find();

//     for (let checkOut of checkouts) {
//       // get the business for the checkout
//       const business = await BusinessRegistration.findById(checkOut.business);
//       const orderId = generateOrderId(business.businessName); // Generate dynamic orderId
//       await CheckOut.updateOne(
//         { _id: checkOut._id },
//         {
//           $set: {
//             orderId: orderId,
//           },
//         }
//       );
//       console.log(`Updated orderId for checkout ${checkOut._id}: ${orderId}`);
//     }

//     console.log("All orderIds have been updated.");

//     res.status(200).json(checkouts);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

module.exports = {
  getCart,
  checkoutCart,
  getCheckOuts,
  getAllCheckOuts,
  getCheckoutYears,
  setCartQuantity,
  setPrice,
  increaseCartItems,
  decreaseCartitems,
  deleteCartItem,
  generateReceipt,
  sendReceipt,
  addToCart,
  sendReceiptToPrinter,
  returnItemSold,
  getCustomers,
  getIncompletePayments,
  updateIncompletePayment,
  updateDeliveryStatus,
  // updateOrderIds,
};
