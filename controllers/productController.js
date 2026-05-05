const asyncHandler = require("express-async-handler");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const { fileSizeFormatter } = require("../utils/fileUpload");
const Sales = require("../models/salesModel");
const Expense = require("../models/expenseModel");
const Discount = require("../models/discountModel");
const moment = require("moment");
const Cart = require("../models/cartModel");
const { linkArrays } = require("../utils/linkArrays");
const mongoose = require("mongoose");
const crypto = require("crypto");
const CheckOut = require("../models/checkOutSalesModel");
const Draft = require("../models/DraftModel");
const { uploadImageToS3 } = require("../utils/fileDownload");
const logActivity = require("../middleWare/logActivityMiddleware");
const { eventBus, EventTypes } = require("../events");
const { sendEmailWithAttachment } = require("../utils/sendEmail");
const cloudinary = require("cloudinary").v2;
const {
  addHistoryEntry,
  addGroupHistoryEntry,
  calculateProductSalesMetrics,
  calculateGroupSalesMetrics,
  updateProductSalesMetrics,
  updateGroupSalesMetrics,
  initializeProductHistory,
  initializeGroupHistory,
} = require("../utils/historyTracking");
const {
  createDiscountResolutionContext,
  resolveEffectiveDiscount,
} = require("../services/marketplace/discountResolver");

const RECORDED_SALES_DISCOUNT_TYPES = ["recorded_sales"];

const deepEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== typeof obj2) return false;
  if (typeof obj1 === "object" && obj1 !== null && obj2 !== null) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
  }
  return false;
};

const extractOptionValues = (options) => {
  return options.map((option) =>
    option.attr.map((attr) => attr.value).filter((value) => value !== ""),
  );
};

const parseJsonArrayField = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

const normalizeListingOptions = (
  rawListingOptions = [],
  attributes = [],
  options = {},
) => {
  const listingOptions = Array.isArray(rawListingOptions) ? rawListingOptions : [];

  return listingOptions
    .map((entry = {}) => {
      const attributeIndex = Number(entry.attributeIndex);
      if (Number.isNaN(attributeIndex) || attributeIndex < 0) return null;

      const fallbackAttribute = attributes?.[attributeIndex] || "";
      const attribute =
        typeof entry.attribute === "string" && entry.attribute.trim() !== ""
          ? entry.attribute.trim()
          : fallbackAttribute;

      const optionGroup = options?.[attributeIndex];
      const availableOptions = Array.isArray(optionGroup?.attr)
        ? optionGroup.attr
            .map((opt) =>
              typeof opt?.value === "string" ? opt.value.trim() : "",
            )
            .filter(Boolean)
        : [];

      const rawOptions = Array.isArray(entry.options) ? entry.options : [];
      const normalizedOptions = [...new Set(
        rawOptions
          .map((value) =>
            typeof value === "string" ? value.trim() : "",
          )
          .filter((value) => value !== "" && availableOptions.includes(value)),
      )];

      if (!attribute || normalizedOptions.length === 0) return null;

      return {
        attribute,
        attributeIndex,
        options: normalizedOptions,
      };
    })
    .filter(Boolean);
};

const normalizeImageObject = (image) => {
  if (!image || typeof image !== "object") return {};
  return image;
};

const normalizeImageEntry = (imageEntry) => {
  if (Array.isArray(imageEntry)) {
    return imageEntry
      .map((image) => normalizeImageObject(image))
      .filter((image) => Object.keys(image).length > 0);
  }

  const normalized = normalizeImageObject(imageEntry);
  return Object.keys(normalized).length > 0 ? [normalized] : [];
};

const normalizeImagesArray = (images, targetLength) => {
  return Array.from({ length: targetLength }, (_, index) =>
    normalizeImageObject(images?.[index]),
  );
};

const getImageIdentity = (image) => {
  if (!image || typeof image !== "object") return "";
  return image.filePath || image.fileName || JSON.stringify(image);
};

const countCombinedImages = (productImages = [], groupImages = []) => {
  const merged = [...(Array.isArray(productImages) ? productImages : []), ...(Array.isArray(groupImages) ? groupImages : [])];
  const seen = new Set();

  merged.forEach((image) => {
    const key = getImageIdentity(image);
    if (key) {
      seen.add(key);
    }
  });

  return seen.size;
};

const normalizeImageEntriesArray = (images, targetLength) => {
  return Array.from({ length: targetLength }, (_, index) =>
    normalizeImageEntry(images?.[index]),
  );
};

const toImageArray = (images, legacyImage = {}) => {
  if (Array.isArray(images)) {
    return images
      .map((image) => normalizeImageObject(image))
      .filter((image) => Object.keys(image).length > 0);
  }

  const normalizedLegacy = normalizeImageObject(legacyImage);
  if (Object.keys(normalizedLegacy).length > 0) {
    return [normalizedLegacy];
  }

  return [];
};

const getPrimaryImage = (images = [], legacyImage = {}) => {
  const imageList = toImageArray(images, legacyImage);
  return imageList[0] || {};
};

const normalizeVariantText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const generateVariantKey = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : new mongoose.Types.ObjectId().toString();

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes"].includes(value.toLowerCase().trim());
  }
  return false;
};

const emitGroupUpdateMetric = (metric, payload = {}) => {
  console.info(
    JSON.stringify({
      service: "product_group_update",
      metric,
      ...payload,
    }),
  );
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return "";
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPlainProduct = (product) => {
  if (!product) return null;
  if (typeof product.toObject === "function") {
    return product.toObject();
  }
  return { ...product };
};

const enrichProductWithRecordedSalesDiscount = async ({
  businessId,
  product,
  discountContext,
}) => {
  if (!product) return product;

  const baseProduct = toPlainProduct(product);
  const basePrice = toNumber(baseProduct.price);

  const discountResult = await resolveEffectiveDiscount({
    businessId,
    productId: baseProduct._id,
    variantProductId: baseProduct._id,
    groupId: baseProduct.itemGroup || null,
    basePrice,
    discountContext,
    discountTypes: RECORDED_SALES_DISCOUNT_TYPES,
  });

  const hasDiscount = Boolean(discountResult?.applied);

  return {
    ...baseProduct,
    effectivePrice: toNumber(discountResult?.effectivePrice ?? basePrice),
    hasRecordedSalesDiscount: hasDiscount,
    discountPricing: {
      hasDiscount,
      originalPrice: basePrice,
      discountedPrice: toNumber(discountResult?.effectivePrice ?? basePrice),
      discountId: discountResult?.discount?.id || null,
      discountName: discountResult?.discount?.name || "",
      discountValueType: discountResult?.discount?.valueType || "",
      discountAmount: toNumber(discountResult?.discount?.amount || 0),
      discountType: hasDiscount ? "recorded_sales" : "none",
    },
  };
};

const enrichProductsWithRecordedSalesDiscounts = async ({ businessId, products = [] }) => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const discountContext = await createDiscountResolutionContext({
    businessId,
    discountTypes: RECORDED_SALES_DISCOUNT_TYPES,
  });

  return Promise.all(
    products.map((product) =>
      enrichProductWithRecordedSalesDiscount({
        businessId,
        product,
        discountContext,
      }),
    ),
  );
};

const buildVariantDiff = ({ existingProducts = [], incomingVariants = [] }) => {
  const matched = [];
  const toCreate = [];
  const toRemove = [];

  const usedExistingIds = new Set();
  const existingByVariantKey = new Map();
  const existingByName = new Map();
  const existingBySku = new Map();

  existingProducts.forEach((product) => {
    const id = product?._id?.toString?.();
    if (!id) return;

    const variantKey = normalizeVariantText(product.variantKey);
    if (variantKey) {
      existingByVariantKey.set(variantKey, product);
    }

    const normalizedName = normalizeVariantText(product.name);
    if (normalizedName) {
      if (!existingByName.has(normalizedName)) {
        existingByName.set(normalizedName, []);
      }
      existingByName.get(normalizedName).push(product);
    }

    const normalizedSku = normalizeVariantText(product.sku);
    if (normalizedSku) {
      if (!existingBySku.has(normalizedSku)) {
        existingBySku.set(normalizedSku, []);
      }
      existingBySku.get(normalizedSku).push(product);
    }
  });

  const matchAndMark = (incoming, candidate) => {
    if (!candidate?._id) return false;
    const existingId = candidate._id.toString();
    if (usedExistingIds.has(existingId)) return false;

    usedExistingIds.add(existingId);
    matched.push({ existing: candidate, incoming });
    return true;
  };

  incomingVariants.forEach((incoming) => {
    const normalizedKey = normalizeVariantText(incoming.variantKey);
    if (!normalizedKey) return;

    const candidate = existingByVariantKey.get(normalizedKey);
    if (candidate && matchAndMark(incoming, candidate)) return;
  });

  incomingVariants.forEach((incoming) => {
    if (matched.some((item) => item.incoming.__localId === incoming.__localId)) {
      return;
    }

    const normalizedName = normalizeVariantText(incoming.itemName);
    const candidates = existingByName.get(normalizedName) || [];
    const available = candidates.filter(
      (candidate) => !usedExistingIds.has(candidate._id.toString()),
    );

    if (available.length === 1 && matchAndMark(incoming, available[0])) return;
  });

  incomingVariants.forEach((incoming) => {
    if (matched.some((item) => item.incoming.__localId === incoming.__localId)) {
      return;
    }

    const normalizedSku = normalizeVariantText(incoming.sku);
    const candidates = existingBySku.get(normalizedSku) || [];
    const available = candidates.filter(
      (candidate) => !usedExistingIds.has(candidate._id.toString()),
    );

    if (available.length === 1 && matchAndMark(incoming, available[0])) return;
  });

  incomingVariants.forEach((incoming) => {
    if (!matched.some((item) => item.incoming.__localId === incoming.__localId)) {
      toCreate.push(incoming);
    }
  });

  existingProducts.forEach((existing) => {
    const existingId = existing?._id?.toString?.();
    if (!existingId || usedExistingIds.has(existingId)) return;
    toRemove.push(existing);
  });

  return {
    matched,
    toCreate,
    toRemove,
  };
};

const shouldDraftDiscountAfterDetach = (discount) => {
  const productsCount = Array.isArray(discount?.appliedProducts)
    ? discount.appliedProducts.length
    : 0;
  const groupsCount = Array.isArray(discount?.appliedProductGroups)
    ? discount.appliedProductGroups.length
    : 0;
  const groupItemsCount = Array.isArray(discount?.appliedGroupItems)
    ? discount.appliedGroupItems.length
    : 0;

  const hasSingleTargets = productsCount > 0;
  const hasGroupAllTargets = groupsCount > 0 && discount?.groupSelection !== "selected_items";
  const hasGroupSelectedTargets = groupItemsCount > 0;

  return !hasSingleTargets && !hasGroupAllTargets && !hasGroupSelectedTargets;
};

const uploadFileAndBuildMetadata = async (file, businessId) => {
  const uniqueFilename = `${businessId}-${Date.now()}-${file.originalname}`;
  const uploadedFile = await uploadImageToS3(file.path, uniqueFilename);

  return {
    fileName: file.originalname,
    filePath: uploadedFile.Location,
    fileType: file.mimetype,
    fileSize: fileSizeFormatter(file.size, 2),
  };
};

// Create Prouct
const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, category, quantity, cost, price, description, warehouse, branchId } =
    req.body;

  //   Validation
  if (!name || !category || !quantity || !price || !description || !cost) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }

  // Determine the business ID for product creation
  // If branchId is provided, use it; otherwise use the current business context
  let businessId = req.business.id;

  if (branchId && branchId !== req.business.id) {
    businessId = branchId;
  }

  // Handle Image upload
  let images = [];
  const uploadedFiles = Array.isArray(req.files)
    ? req.files
    : req.file
      ? [req.file]
      : [];
  const imageFiles = Array.isArray(req.files)
    ? uploadedFiles.filter((file) => !file.fieldname || file.fieldname === "image")
    : uploadedFiles;

  if (imageFiles.length > 0) {
    for (const imageFile of imageFiles) {
      try {
        const metadata = await uploadFileAndBuildMetadata(imageFile, businessId);
        images.push(metadata);
      } catch (error) {
        console.error("Image upload failed:", error.message);
      }
    }
  }

  // Create Product
  try {
    const product = await Product.create({
      business: businessId,
      productIsaGroup: false,
      name,
      sku,
      category,
      warehouse,
      quantity,
      cost,
      price,
      description,
      images,
      image: images[0] || {},
      history: [
        {
          date: new Date(),
          type: "stock-in",
          quantityChange: Number(quantity),
          balance: Number(quantity),
          performedBy:
            (req.user && (req.user.name || req.user.email)) ||
            (req.body.user && (req.body.user.name || req.body.user.email)) ||
            "system",
          note: "Initial stock entry",
        },
      ],
      totalStocked: Number(quantity),
      totalSold: 0,
      totalRevenue: 0,
    });

    const activity = `Created new product "${name}" in category "${category}" with initial stock of ${quantity} units at ₦${price.toLocaleString()} (cost: ₦${cost.toLocaleString()}) in warehouse "${warehouse}"`;
    logActivity(activity)(req, res);

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const createMultipleProducts = asyncHandler(async (req, res) => {
  try {
    if (!req.body.groupName || !req.body.category || !req.body.description) {
      throw new Error("Missing required fields");
    }

    // Parse branch selection data
    const selectedBranches = parseJsonArrayField(req.body.selectedBranches, []);
    const quantityDistribution = req.body.quantityDistribution || "same";
    const branchQuantities = parseJsonArrayField(req.body.branchQuantities, {});

    // Validate that at least one branch is selected
    if (selectedBranches.length === 0) {
      throw new Error("At least one branch must be selected");
    }

    const itemName = JSON.parse(req.body.combinations);
    const sku = JSON.parse(req.body.sku);
    const cost = JSON.parse(req.body.cost);
    const price = JSON.parse(req.body.price);
    const warehouse = JSON.parse(req.body.warehouse);
    const quantity = JSON.parse(req.body.quantity);

    if (
      !Array.isArray(itemName) ||
      !Array.isArray(sku) ||
      !Array.isArray(cost) ||
      !Array.isArray(price) ||
      !Array.isArray(warehouse) ||
      !Array.isArray(quantity) ||
      itemName.length !== sku.length ||
      itemName.length !== cost.length ||
      itemName.length !== price.length ||
      itemName.length !== warehouse.length ||
      itemName.length !== quantity.length
    ) {
      throw new Error("Invalid combinations of product information");
    }

    let groupImages = [];
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const groupImageFiles = uploadedFiles.filter(
      (file) => file.fieldname === "image",
    );

    if (groupImageFiles.length > 0) {
      for (const groupImageFile of groupImageFiles) {
        try {
          const metadata = await uploadFileAndBuildMetadata(
            groupImageFile,
            req.business.id,
          );
          groupImages.push(metadata);
        } catch (error) {
          console.error("Image upload failed:", error.message);
        }
      }
    }

    const combinationImagesFromBody = parseJsonArrayField(
      req.body.combinationImages,
      [],
    );
    const normalizedCombinationImages = normalizeImageEntriesArray(
      combinationImagesFromBody,
      itemName.length,
    );

    const combinationImageFiles = uploadedFiles.filter((file) =>
      /^combinationImages?_\d+$/.test(file.fieldname),
    );

    for (const combinationImageFile of combinationImageFiles) {
      const variantIndex = Number(
        combinationImageFile.fieldname.replace(/^combinationImages?_/, ""),
      );

      if (Number.isNaN(variantIndex) || variantIndex < 0) continue;

      try {
        const metadata = await uploadFileAndBuildMetadata(
          combinationImageFile,
          req.business.id,
        );
        normalizedCombinationImages[variantIndex] = [
          ...(normalizedCombinationImages[variantIndex] || []),
          metadata,
        ];
      } catch (error) {
        console.error(
          `Combination image upload failed for index ${variantIndex}:`,
          error.message,
        );
      }
    }

    const performedBy =
      (req.user && (req.user.name || req.user.email)) ||
      (req.body.user && (req.body.user.name || req.body.user.email)) ||
      "system";

    const products = linkArrays(
      ["itemName", "sku", "cost", "price", "warehouse", "quantity"],
      itemName,
      sku,
      cost,
      price,
      warehouse,
      quantity,
    );

    const groupHistoryEntries = products.map((prod) => {
      const initialQty = Number(prod.quantity) || 0;

      return {
        date: new Date(),
        type: "stock-in",
        itemName: prod.itemName,
        quantityChange: initialQty,
        balance: initialQty,
        performedBy,
        note: "Initial stock entry",
      };
    });

    // Calculate quantities for each branch based on distribution method
    const getQuantitiesForBranch = (branchId, originalQuantities) => {
      if (quantityDistribution === "split" && branchQuantities[branchId] !== undefined) {
        // Return branch-specific quantities if split distribution is used
        return originalQuantities.map(() => branchQuantities[branchId]);
      }
      // For "same" distribution or if no branch-specific quantity is set, return original quantities
      return originalQuantities;
    };

    // Create product groups and products for each selected branch
    const allCreatedProducts = [];
    const createdProductGroups = [];

    for (const branchId of selectedBranches) {
      const branchQuantities_forThisBranch = getQuantitiesForBranch(branchId, quantity);

      const branchGroupHistoryEntries = products.map((prod, index) => {
        const branchQty = Array.isArray(branchQuantities_forThisBranch)
          ? branchQuantities_forThisBranch[index]
          : branchQuantities_forThisBranch;
        const initialQty = Number(branchQty) || 0;

        return {
          date: new Date(),
          type: "stock-in",
          itemName: prod.itemName,
          quantityChange: initialQty,
          balance: initialQty,
          performedBy,
          note: "Initial stock entry",
        };
      });

      const branchInitialTotalStocked = branchGroupHistoryEntries.reduce(
        (sum, entry) => sum + entry.quantityChange,
        0,
      );

      // Create product group for this branch
      const productGroup = await ProductGroup.create({
        business: branchId,
        groupName: req.body.groupName,
        category: req.body.category,
        description: req.body.description,
        isProductUnique: req.body.isProductUnique,
        cost: JSON.parse(req.body.cost),
        price: JSON.parse(req.body.price),
        sku: JSON.parse(req.body.sku),
        warehouse: JSON.parse(req.body.warehouse),
        quantity: branchQuantities_forThisBranch,
        attributes: JSON.parse(req.body.attributes),
        options: JSON.parse(req.body.options),
        listingOptions: normalizeListingOptions(
          parseJsonArrayField(req.body.listingOptions, []),
          JSON.parse(req.body.attributes),
          JSON.parse(req.body.options),
        ),
        combinations: JSON.parse(req.body.combinations),
        combinationImages: normalizedCombinationImages,
        images: groupImages,
        image: groupImages[0] || {},
        history: branchGroupHistoryEntries,
        totalStocked: branchInitialTotalStocked,
        totalSold: 0,
        totalRevenue: 0,
      });

      createdProductGroups.push(productGroup);

      const incomingVariantKeys = parseJsonArrayField(req.body.variantKeys, []);

      // Create products for this branch
      const branchCreatedProducts = await Promise.all(
        products.map((prod, index) => {
          const variantKey =
            normalizeVariantText(incomingVariantKeys?.[index]) || generateVariantKey();
          const branchQty = Array.isArray(branchQuantities_forThisBranch)
            ? branchQuantities_forThisBranch[index]
            : branchQuantities_forThisBranch;

          return Product.create({
            business: branchId,
            productIsaGroup: true,
            itemGroup: productGroup?._id,
            variantKey,
            variantLabel: prod.itemName,
            isProductUnique: req.body.isProductUnique,
            name: prod.itemName,
            sku: prod.sku,
            warehouse: prod.warehouse,
            category: req.body.category,
            quantity: Number(branchQty),
            cost: prod.cost,
            price: prod.price,
            description: req.body.description,
            images: toImageArray(
              normalizedCombinationImages[index],
              groupImages[0] || {},
            ),
            image: getPrimaryImage(
              normalizedCombinationImages[index],
              groupImages[0] || {},
            ),
            history: [
              {
                date: new Date(),
                type: "stock-in",
                quantityChange: Number(branchQty) || 0,
                balance: Number(branchQty) || 0,
                performedBy,
                note: "Initial stock entry",
              },
            ],
            totalStocked: Number(branchQty) || 0,
            totalSold: 0,
            totalRevenue: 0,
          });
        }),
      );

      productGroup.variantMap = branchCreatedProducts.map((product, index) => ({
        variantKey: product.variantKey,
        combination: products[index]?.itemName || "",
        sku: products[index]?.sku || "",
        indexHint: index,
        lastKnownProductId: product._id,
      }));
      productGroup.markModified("variantMap");
      await productGroup.save();

      allCreatedProducts.push(...branchCreatedProducts);
    }

    const totalVariants = JSON.parse(req.body.combinations).length;
    const attributes = JSON.parse(req.body.attributes);
    const activity = `Created new product group "${
      req.body.groupName
    }" in category "${
      req.body.category
    }" with ${totalVariants} variant(s) across ${selectedBranches.length} branch(es) and ${
      attributes.length
    } attribute(s): ${attributes.join(", ")}`;
    logActivity(activity)(req, res);

    // Emit events for each branch to ensure real-time updates reach all branch clients
    for (const branchId of selectedBranches) {
      const branchProducts = allCreatedProducts.filter((p) => p.business.toString() === branchId.toString());
      const branchProductGroups = createdProductGroups.filter((g) => g.business.toString() === branchId.toString());

      if (branchProducts.length > 0) {
        eventBus.emitBusinessEvent(
          EventTypes.PRODUCT_GROUP_CREATED,
          branchId.toString(),
          {
            productGroups: branchProductGroups,
            products: branchProducts,
            totalBranches: selectedBranches.length,
          },
          { source: "product_group_create_multiple", branch: branchId.toString() },
        );
      }
    }

    res.json({
      data: {
        productGroups: createdProductGroups,
        products: allCreatedProducts,
        totalBranches: selectedBranches.length,
      },
    });
  } catch (error) {
    throw new Error(error.message);
  }
});

// Update Product Group
const updateProductGroup = asyncHandler(async (req, res) => {
  const itemName = JSON.parse(req.body.combinations);
  const sku = JSON.parse(req.body.sku);
  const cost = JSON.parse(req.body.cost);
  const price = JSON.parse(req.body.price);
  const warehouse = JSON.parse(req.body.warehouse);
  const quantity = JSON.parse(req.body.quantity).map(Number);

  let groupImages = [];
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const groupImageFiles = uploadedFiles.filter(
    (file) => file.fieldname === "image",
  );

  if (groupImageFiles.length > 0) {
    for (const groupImageFile of groupImageFiles) {
      try {
        const metadata = await uploadFileAndBuildMetadata(
          groupImageFile,
          req.business.id,
        );
        groupImages.push(metadata);
      } catch (error) {
        console.error("Image upload failed:", error.message);
      }
    }
  }

  const hasExistingImagesPayload = typeof req.body.existingImages !== "undefined";
  const payloadExistingImages = parseJsonArrayField(req.body.existingImages, []);

  const { id } = req.params;
  const confirmDetachConflicts = parseBooleanFlag(req.body.confirmDetachConflicts);
  const productGroup = await ProductGroup.findById(id);

  if (!productGroup) {
    throw new Error("Product Group not Found");
  }

  // Keep a snapshot of the original document for comparison after changes
  const originalProductGroup = productGroup.toObject();
  const originalQuantity = productGroup.quantity.map(Number);

  // Initialize history if it doesn't exist
  if (!productGroup.history) {
    productGroup.history = [];
    productGroup.totalStocked = 0;
    productGroup.totalSold = 0;
    productGroup.totalRevenue = 0;
  }

  // Debug: Log received options data
  // console.log("=== UPDATE PRODUCT GROUP DEBUG ===");
  // console.log("Received options from request:", req.body.options);
  // console.log("Parsed options:", JSON.parse(req.body.options));
  // console.log("Current options in DB:", productGroup.options);
  // console.log("================================");

  // console.log("req.body.isProductUnique", req.body.isProductUnique);

  const existingGroupProducts = await Product.find({
    business: req.business.id,
    itemGroup: productGroup?._id,
    productIsaGroup: true,
  });

  const products = linkArrays(
    ["itemName", "sku", "cost", "price", "warehouse", "quantity"],
    itemName,
    sku,
    cost,
    price,
    warehouse,
    quantity,
  );

  const hasCombinationImagesPayload =
    typeof req.body.combinationImages !== "undefined";
  const payloadCombinationImages = parseJsonArrayField(
    req.body.combinationImages,
    [],
  );
  const existingCombinationImages = Array.isArray(productGroup.combinationImages)
    ? productGroup.combinationImages
    : [];

  const baseCombinationImages = hasCombinationImagesPayload
    ? payloadCombinationImages
    : existingCombinationImages;

  const normalizedCombinationImages = normalizeImageEntriesArray(
    baseCombinationImages,
    itemName.length,
  );

  const combinationImageFiles = uploadedFiles.filter((file) =>
    /^combinationImages?_\d+$/.test(file.fieldname),
  );

  for (const combinationImageFile of combinationImageFiles) {
    const variantIndex = Number(
      combinationImageFile.fieldname.replace(/^combinationImages?_/, ""),
    );

    if (Number.isNaN(variantIndex) || variantIndex < 0) continue;

    try {
      const metadata = await uploadFileAndBuildMetadata(
        combinationImageFile,
        req.business.id,
      );
      normalizedCombinationImages[variantIndex] = [
        ...(normalizedCombinationImages[variantIndex] || []),
        metadata,
      ];
    } catch (error) {
      console.error(
        `Combination image upload failed for index ${variantIndex}:`,
        error.message,
      );
    }
  }

  const preservedGroupImages = hasExistingImagesPayload
    ? toImageArray(payloadExistingImages, {})
    : toImageArray(productGroup.images, productGroup.image);
  const finalGroupImages = [...preservedGroupImages, ...groupImages];

  const updatedProductGroupData = {
    groupName: req.body.groupName,
    category: req.body.category,
    description: req.body.description,
    cost: JSON.parse(req.body.cost).map(Number),
    price: JSON.parse(req.body.price).map(Number),
    sku: JSON.parse(req.body.sku),
    warehouse: JSON.parse(req.body.warehouse),
    isProductUnique: req.body.isProductUnique === "true",
    attributes: JSON.parse(req.body.attributes),
    quantity: JSON.parse(req.body.quantity).map(Number),
    options: JSON.parse(req.body.options),
    listingOptions: normalizeListingOptions(
      parseJsonArrayField(req.body.listingOptions, []),
      JSON.parse(req.body.attributes),
      JSON.parse(req.body.options),
    ),
    combinations: JSON.parse(req.body.combinations),
    combinationImages: normalizedCombinationImages,
    images: finalGroupImages,
    image: finalGroupImages[0] || {},
  };

  // Update the document directly and save to ensure proper nested object handling
  productGroup.groupName = updatedProductGroupData.groupName;
  productGroup.category = updatedProductGroupData.category;
  productGroup.description = updatedProductGroupData.description;
  productGroup.cost = updatedProductGroupData.cost;
  productGroup.price = updatedProductGroupData.price;
  productGroup.sku = updatedProductGroupData.sku;
  productGroup.warehouse = updatedProductGroupData.warehouse;
  productGroup.isProductUnique = updatedProductGroupData.isProductUnique;
  productGroup.attributes = updatedProductGroupData.attributes;
  productGroup.quantity = updatedProductGroupData.quantity;
  productGroup.markModified("quantity");
  productGroup.markModified("price");
  productGroup.markModified("cost");
  productGroup.markModified("sku");
  productGroup.markModified("warehouse");
  productGroup.markModified("attributes");

  // Track quantity changes for history and totalStocked
  const quantityChanges = [];
  let totalQuantityAdded = 0;

  for (let i = 0; i < updatedProductGroupData.quantity.length; i++) {
    const newQty = updatedProductGroupData.quantity[i];
    const oldQty = originalQuantity[i] || 0;
    const change = newQty - oldQty;

    if (change !== 0) {
      const variantName = itemName[i];
      const combinationKey = productGroup.combinations[i] || variantName;
      quantityChanges.push({
        index: i,
        itemName: combinationKey,
        change,
        newQty,
      });

      if (change > 0) {
        totalQuantityAdded += change;
      }
    }
  }

  // Add history entries for quantity changes
  if (quantityChanges.length > 0) {
    // Initialize totalStocked if this is the first edit
    // if (productGroup.history.length === 0) {
    //   productGroup.totalStocked = originalQuantity.reduce((a, b) => a + b, 0);
    // }

    for (const change of quantityChanges) {
      if (change.change > 0) {
        const historyEntry = {
          date: new Date(),
          type: "stock-in",
          itemName: change.itemName,
          quantityChange: change.change,
          balance: change.newQty,
          performedBy:
            (req.user && (req.user.name || req.user.email)) ||
            (req.body.user && (req.body.user.name || req.body.user.email)) ||
            "system",
          note: "",
        };
        productGroup.history.push(historyEntry);
        productGroup.totalStocked += change.change;
      } else if (change.change < 0) {
        const historyEntry = {
          date: new Date(),
          type: "adjustment",
          itemName: change.itemName,
          quantityChange: change.change,
          balance: change.newQty,
          performedBy:
            (req.user && (req.user.name || req.user.email)) ||
            (req.body.user && (req.body.user.name || req.body.user.email)) ||
            "system",
          note: "",
        };
        productGroup.history.push(historyEntry);
        productGroup.totalStocked += change.change;
      }
    }
  }

  // Replace options object completely to handle deletions
  productGroup.options = updatedProductGroupData.options;
  productGroup.markModified("options"); // Mark as modified for Mongoose to detect changes
  productGroup.listingOptions = updatedProductGroupData.listingOptions;
  productGroup.markModified("listingOptions");

  productGroup.combinations = updatedProductGroupData.combinations;
  productGroup.markModified("combinations");
  productGroup.combinationImages = updatedProductGroupData.combinationImages;
  productGroup.markModified("combinationImages");
  productGroup.images = updatedProductGroupData.images;
  productGroup.markModified("images");
  productGroup.image = updatedProductGroupData.image;

  const payloadVariantKeys = parseJsonArrayField(req.body.variantKeys, []);
  const existingVariantMap = Array.isArray(productGroup.variantMap)
    ? productGroup.variantMap
    : [];

  const variantKeyByCombination = new Map();
  existingVariantMap.forEach((entry) => {
    const key = normalizeVariantText(entry?.combination);
    const variantKey = normalizeVariantText(entry?.variantKey);
    if (key && variantKey) {
      variantKeyByCombination.set(key, variantKey);
    }
  });

  const incomingVariants = products.map((prod, index) => {
    const normalizedCombination = normalizeVariantText(prod.itemName);
    const payloadVariantKey = normalizeVariantText(payloadVariantKeys?.[index]);
    const mappedVariantKey = variantKeyByCombination.get(normalizedCombination) || "";

    return {
      __localId: `variant_${index}`,
      index,
      variantKey: payloadVariantKey || mappedVariantKey,
      itemName: prod.itemName,
      sku: prod.sku,
      category: req.body.category,
      quantity: Number(prod.quantity),
      warehouse: prod.warehouse,
      cost: Number(prod.cost),
      price: Number(prod.price),
      description: req.body.description,
      images: toImageArray(
        updatedProductGroupData.combinationImages[index],
        updatedProductGroupData.image || {},
      ),
      image: getPrimaryImage(
        updatedProductGroupData.combinationImages[index],
        updatedProductGroupData.image || {},
      ),
    };
  });

  const { matched, toCreate, toRemove } = buildVariantDiff({
    existingProducts: existingGroupProducts,
    incomingVariants,
  });

  const removedVariantIds = toRemove.map((item) => item._id.toString());

  const impactedDiscounts = removedVariantIds.length
    ? await Discount.find({
        business: req.business.id,
        $or: [
          { appliedProducts: { $in: removedVariantIds } },
          { appliedGroupItems: { $in: removedVariantIds } },
        ],
      })
        .select("_id discountName appliedProducts appliedGroupItems appliedProductGroups groupSelection")
        .lean()
    : [];

  const discountsAffected = impactedDiscounts
    .map((discount) => {
      const affectedVariantIds = removedVariantIds.filter((variantId) => {
        const inProducts = (discount.appliedProducts || []).some(
          (value) => value?.toString?.() === variantId,
        );
        const inGroupItems = (discount.appliedGroupItems || []).some(
          (value) => value?.toString?.() === variantId,
        );
        return inProducts || inGroupItems;
      });

      return {
        discountId: discount._id.toString(),
        discountName: discount.discountName,
        affectedVariantIds,
      };
    })
    .filter((item) => item.affectedVariantIds.length > 0);

  const cartsAffectedCount = removedVariantIds.length
    ? await Cart.countDocuments({
        business: req.business._id,
        "items.id": { $in: removedVariantIds },
      })
    : 0;

  const marketplaceRiskCount = toRemove.filter((variant) => Boolean(variant.listProduct)).length;

  const hasDetachImpact =
    removedVariantIds.length > 0 &&
    (discountsAffected.length > 0 || cartsAffectedCount > 0 || marketplaceRiskCount > 0);

  if (hasDetachImpact && !confirmDetachConflicts) {
    emitGroupUpdateMetric("groupUpdate.requiresConfirmation", {
      businessId: req.business.id?.toString?.() || String(req.business?.id || ""),
      groupId: productGroup._id?.toString?.() || "",
      removedCount: removedVariantIds.length,
      discountsAffectedCount: discountsAffected.length,
      cartsAffectedCount,
      marketplaceRiskCount,
    });

    return res.status(409).json({
      message:
        "This update will remove variants that are currently referenced. Confirm to continue and auto-detach those references.",
      code: "GROUP_UPDATE_REQUIRES_CONFIRMATION",
      impact: {
        toRemoveVariantIds: removedVariantIds,
        discountsAffected,
        cartsAffectedCount,
        marketplaceRiskCount,
      },
      nextAction: {
        confirmField: "confirmDetachConflicts",
        confirmValue: true,
      },
    });
  }

  let updatedProducts = await productGroup.save();

  const updatedMatchedProducts = await Promise.all(
    matched.map(({ existing, incoming }) =>
      Product.findByIdAndUpdate(
        existing._id,
        {
          business: req.business.id,
          productIsaGroup: true,
          isProductUnique: req.body.isProductUnique === "true",
          itemGroup: updatedProducts?._id,
          variantKey: incoming.variantKey || existing.variantKey || generateVariantKey(),
          variantLabel: incoming.itemName,
          name: incoming.itemName,
          sku: incoming.sku,
          category: incoming.category,
          quantity: incoming.quantity,
          warehouse: incoming.warehouse,
          cost: incoming.cost,
          price: incoming.price,
          description: incoming.description,
          images: incoming.images,
          image: incoming.image,
        },
        { new: true },
      ),
    ),
  );

  const createdProducts = await Promise.all(
    toCreate.map((incoming) =>
      Product.create({
        business: req.business.id,
        productIsaGroup: true,
        isProductUnique: req.body.isProductUnique === "true",
        itemGroup: updatedProducts?._id,
        variantKey: incoming.variantKey || generateVariantKey(),
        variantLabel: incoming.itemName,
        name: incoming.itemName,
        sku: incoming.sku,
        category: incoming.category,
        quantity: incoming.quantity,
        warehouse: incoming.warehouse,
        cost: incoming.cost,
        price: incoming.price,
        description: incoming.description,
        images: incoming.images,
        image: incoming.image,
        history: [],
        totalStocked: 0,
        totalSold: 0,
        totalRevenue: 0,
      }),
    ),
  );

  if (removedVariantIds.length > 0) {
    await Product.deleteMany({ _id: { $in: removedVariantIds } });
  }

  if (removedVariantIds.length > 0 && hasDetachImpact) {
    await Cart.updateMany(
      { business: req.business._id },
      {
        $pull: {
          items: {
            id: { $in: removedVariantIds },
          },
        },
      },
    );

    await Discount.updateMany(
      {
        business: req.business.id,
        $or: [
          { appliedProducts: { $in: removedVariantIds } },
          { appliedGroupItems: { $in: removedVariantIds } },
        ],
      },
      {
        $pull: {
          appliedProducts: { $in: removedVariantIds },
          appliedGroupItems: { $in: removedVariantIds },
        },
      },
    );

    const affectedDiscountIds = discountsAffected.map((item) => item.discountId);
    if (affectedDiscountIds.length > 0) {
      const refreshedDiscounts = await Discount.find({ _id: { $in: affectedDiscountIds } });
      await Promise.all(
        refreshedDiscounts.map((discount) => {
          if (!shouldDraftDiscountAfterDetach(discount)) {
            return Promise.resolve();
          }

          discount.status = "draft";
          discount.isActive = false;
          return discount.save();
        }),
      );
    }

    emitGroupUpdateMetric("groupUpdate.autoDetach", {
      businessId: req.business.id?.toString?.() || String(req.business?.id || ""),
      groupId: productGroup._id?.toString?.() || "",
      removedCount: removedVariantIds.length,
      detachedDiscountRefsCount: discountsAffected.reduce(
        (sum, item) => sum + item.affectedVariantIds.length,
        0,
      ),
      detachedCartRefsCount: cartsAffectedCount,
    });
  }

  const productByLocalId = new Map();
  matched.forEach(({ incoming, existing }, index) => {
    const updatedProduct = updatedMatchedProducts[index] || existing;
    productByLocalId.set(incoming.__localId, updatedProduct);
  });
  toCreate.forEach((incoming, index) => {
    const createdProduct = createdProducts[index];
    if (createdProduct) {
      productByLocalId.set(incoming.__localId, createdProduct);
    }
  });

  updatedProducts.variantMap = incomingVariants
    .map((incoming) => {
      const product = productByLocalId.get(incoming.__localId);
      if (!product) return null;

      return {
        variantKey: product.variantKey || incoming.variantKey || generateVariantKey(),
        combination: incoming.itemName,
        sku: incoming.sku,
        indexHint: incoming.index,
        lastKnownProductId: product._id,
      };
    })
    .filter(Boolean);
  updatedProducts.markModified("variantMap");
  updatedProducts = await updatedProducts.save();

  if (removedVariantIds.length > 0) {
    eventBus.emitBusinessEvent(
      EventTypes.PRODUCT_DELETED,
      req.business.id.toString(),
      { products: removedVariantIds.map((variantId) => ({ _id: variantId })) },
      { source: "product_group_update" },
    );
  }

  if (updatedMatchedProducts.length > 0) {
    eventBus.emitBusinessEvent(
      EventTypes.PRODUCT_UPDATED,
      req.business.id.toString(),
      { products: updatedMatchedProducts.filter(Boolean) },
      { source: "product_group_update" },
    );
  }

  if (createdProducts.length > 0) {
    eventBus.emitBusinessEvent(
      EventTypes.PRODUCT_CREATED,
      req.business.id.toString(),
      { products: createdProducts },
      { source: "product_group_update" },
    );
  }

    // Log activity with meaningful, concise information
    const meaningfulChanges = [];

    // Check for significant changes only (compare against original snapshot)
    if (updatedProductGroupData.groupName !== originalProductGroup.groupName) {
      meaningfulChanges.push(
        `renamed from "${originalProductGroup.groupName}" to "${updatedProductGroupData.groupName}"`,
      );
    }

    if (updatedProductGroupData.category !== originalProductGroup.category) {
      meaningfulChanges.push(
        `category changed from "${originalProductGroup.category}" to "${updatedProductGroupData.category}"`,
      );
    }

    if (
      updatedProductGroupData.description !== originalProductGroup.description
    ) {
      meaningfulChanges.push("updated product description");
    }

    // Check if options changed (new variants added/removed with details)
    const originalOptions = extractOptionValues(
      originalProductGroup.options || [],
    );
    const updatedOptions = extractOptionValues(
      updatedProductGroupData.options || [],
    );
    if (!deepEqual(originalOptions, updatedOptions)) {
      const originalCount = originalProductGroup.combinations?.length || 0;
      const updatedCount = updatedProductGroupData.combinations?.length || 0;
      const originalCombos = originalProductGroup.combinations || [];
      const updatedCombos = updatedProductGroupData.combinations || [];

      if (updatedCount > originalCount) {
        // Find newly added variants
        const newVariants = updatedCombos.filter(
          (combo) => !originalCombos.includes(combo),
        );
        const variantNames = newVariants
          .slice(0, 3)
          .map((v) => `"${v.split(" - ")[1] || v}"`)
          .join(", ");
        const moreText =
          newVariants.length > 3 ? ` and ${newVariants.length - 3} more` : "";
        meaningfulChanges.push(
          `added ${
            updatedCount - originalCount
          } new variant(s): ${variantNames}${moreText}`,
        );
      } else if (updatedCount < originalCount) {
        // Find removed variants
        const removedVariants = originalCombos.filter(
          (combo) => !updatedCombos.includes(combo),
        );
        const variantNames = removedVariants
          .slice(0, 3)
          .map((v) => `"${v.split(" - ")[1] || v}"`)
          .join(", ");
        const moreText =
          removedVariants.length > 3
            ? ` and ${removedVariants.length - 3} more`
            : "";
        meaningfulChanges.push(
          `removed ${
            originalCount - updatedCount
          } variant(s): ${variantNames}${moreText}`,
        );
      } else {
        meaningfulChanges.push("updated product variant details");
      }
    }

    // Check for quantity changes
    const totalOriginalQty = Array.isArray(originalProductGroup.quantity)
      ? originalProductGroup.quantity.reduce(
          (sum, q) => sum + (parseInt(q) || 0),
          0,
        )
      : 0;
    const totalUpdatedQty = Array.isArray(updatedProductGroupData.quantity)
      ? updatedProductGroupData.quantity.reduce(
          (sum, q) => sum + (parseInt(q) || 0),
          0,
        )
      : 0;

    if (totalUpdatedQty !== totalOriginalQty) {
      const qtyDiff = totalUpdatedQty - totalOriginalQty;
      if (qtyDiff > 0) {
        meaningfulChanges.push(`increased stock by ${qtyDiff} units`);
      } else {
        meaningfulChanges.push(`decreased stock by ${Math.abs(qtyDiff)} units`);
      }
    }

    // Check for price changes
    if (!deepEqual(originalProductGroup.price, updatedProductGroupData.price)) {
      meaningfulChanges.push("updated pricing");
    }

    // Check for cost changes
    if (!deepEqual(originalProductGroup.cost, updatedProductGroupData.cost)) {
      meaningfulChanges.push("updated cost values");
    }

    // Check for warehouse changes
    if (
      !deepEqual(
        originalProductGroup.warehouse,
        updatedProductGroupData.warehouse,
      )
    ) {
      meaningfulChanges.push("updated warehouse assignments");
    }

  if (removedVariantIds.length > 0) {
    meaningfulChanges.push(`removed ${removedVariantIds.length} variant(s)`);
  }

  if (createdProducts.length > 0) {
    meaningfulChanges.push(`added ${createdProducts.length} variant(s)`);
  }

    console.log({ meaningfulChanges });

    const activity =
      meaningfulChanges.length > 0
        ? `Updated product group "${
            productGroup.groupName
          }": ${meaningfulChanges.join(", ")}`
        : `Updated product group "${productGroup.groupName}"`;

  await logActivity(activity)(req, res);

  res.status(200).json({
    ...updatedProducts.toObject(),
    updateSummary: {
      mode: "non_destructive",
      matchedCount: matched.length,
      createdCount: createdProducts.length,
      removedCount: removedVariantIds.length,
      detachedDiscountRefsCount: discountsAffected.reduce(
        (sum, item) => sum + item.affectedVariantIds.length,
        0,
      ),
      detachedCartRefsCount: cartsAffectedCount,
    },
  });
});

const updateGroupListingOptions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const productGroup = await ProductGroup.findOne({
    _id: id,
    business: req.business.id,
  });

  if (!productGroup) {
    res.status(404);
    throw new Error("Product Group not Found");
  }

  const listingOptions = normalizeListingOptions(
    Array.isArray(req.body.listingOptions) ? req.body.listingOptions : [],
    Array.isArray(productGroup.attributes) ? productGroup.attributes : [],
    productGroup.options || {},
  );

  productGroup.listingOptions = listingOptions;
  productGroup.markModified("listingOptions");

  const updatedGroup = await productGroup.save();

  res.status(200).json({
    data: updatedGroup,
  });
});

const getProductGroups = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const category = req.query.category ? req.query.category.split(",") : [];
  const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];
  const priceRange = req.query.priceRange
    ? req.query.priceRange.split(",")
    : [];
  const skip = (page - 1) * limit;

  let filter = { business: req.business.id };

  // Add search filter
  if (search) {
    filter.$or = [
      { groupName: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Add category filter
  if (category.length > 0) {
    filter.category = { $in: category };
  }

  // Add warehouse filter (check if any variant has matching warehouse)
  if (warehouse.length > 0) {
    filter.warehouse = { $elemMatch: { $in: warehouse } };
  }

  // Add price range filter (check if any variant price falls in range)
  if (priceRange.length > 0) {
    const priceConditions = [];
    priceRange.forEach((range) => {
      if (range === "0-50") {
        priceConditions.push({ price: { $elemMatch: { $gte: 0, $lte: 50 } } });
      } else if (range === "50-100") {
        priceConditions.push({
          price: { $elemMatch: { $gte: 50, $lte: 100 } },
        });
      } else if (range === "100-500") {
        priceConditions.push({
          price: { $elemMatch: { $gte: 100, $lte: 500 } },
        });
      } else if (range === "500+") {
        priceConditions.push({ price: { $elemMatch: { $gte: 500 } } });
      }
    });
    if (priceConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: priceConditions });
    }
  }

  const total = await ProductGroup.countDocuments(filter);
  const products = await ProductGroup.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  // Calculate aggregated statistics for ALL filtered product groups
  const allFilteredGroups = await ProductGroup.find(filter).select(
    "price cost quantity combinations",
  );

  let aggregatedStats = {
    totalValue: 0,
    totalCost: 0,
    totalVariants: 0,
    totalGroups: total,
  };

  allFilteredGroups.forEach((group) => {
    const variantCount = group.combinations?.length || 0;
    aggregatedStats.totalVariants += variantCount;

    // Sum up all variant prices/costs if they're arrays
    if (Array.isArray(group.price)) {
      group.price.forEach((price, idx) => {
        const qty = group.quantity?.[idx] || 0;
        aggregatedStats.totalValue += (price || 0) * qty;
      });
    }

    if (Array.isArray(group.cost)) {
      group.cost.forEach((cost, idx) => {
        const qty = group.quantity?.[idx] || 0;
        aggregatedStats.totalCost += (cost || 0) * qty;
      });
    }
  });

  res.status(200).json({
    products,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
    aggregatedStats,
  });
});

// Sell a product
const sellProduct = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  // console.log("quantity: ", req.body);

  const product = await Product.findById(req.params.id);
  // if product doesnt exist
  if (!product) {
    res.status(404);
    throw new Error("Product Not Found");
  }

  if (!quantity || quantity === undefined) {
    res.status(401);
    throw new Error("Please add all parameters");
  }

  const remainder = product.quantity - quantity;

  if (quantity <= 0) {
    res.status(409);
    throw new Error("Please add quantity");
  }

  if (remainder < 0) {
    res.status(409);
    throw new Error("Available product is less than " + quantity);
  }

  product.quantity = remainder;
  const sales = await Sales.create({
    business: req.business.id,
    name: product.name,
    cost: product.cost,
    productId: product._id,
    category: product.category,
    price: product.price,
    quantity: quantity,
    createdAt: Date.now(),
  });

  // sales.save();

  if (product.productIsaGroup && Number(product.quantity) === 0) {
    await product.remove();
  } else {
    await product.save();
  }

  res.status(201).json(sales);
});

const addToCart = asyncHandler(async (req, res) => {
  const { quantity, price, name, id } = req.body;

  if (!quantity || quantity === "" || quantity <= 0) {
    res.status(400);
    throw new Error("Please add quantity");
  }

  const businessId = req.business._id;
  // console.log(req.body);

  try {
    let cart = await Cart.findOne({ business: req.business._id });

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id === id);

      if (itemIndex > -1) {
        //product exists in the cart, update the quantity
        let productItem = cart.items[itemIndex];
        productItem.quantity = quantity;
        cart.items[itemIndex] = productItem;
      } else {
        //product does not exists in cart, add new item
        cart.items.push({ id, quantity, name, price });
      }
      cart = await cart.save();
      return res.status(201).send(cart);
    } else {
      //no cart for user, create new cart
      const newCart = await Cart.create({
        business: businessId,
        items: [{ id: id, quantity: quantity, name: name, price: price }],
      });

      return res.status(201).send(newCart);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong");
  }
});

const getCart = asyncHandler(async (req, res) => {
  const carts = await Cart.findOne({ business: req.business.id });
  res.status(200).json(carts);
});

const updateCart = asyncHandler(async (req, res) => {
  const { id, cartId, quantity } = req.body;
  // console.log(req.body);
  try {
    let cart = await Cart.findOne({ business: req.business._id });

    if (cart) {
      //cart exists for user
      let itemIndex = cart.items.findIndex((p) => p._id == cartId);

      if (itemIndex > -1) {
        //product exists in the store, update the quantity
        let productItem = cart.items[itemIndex];
        // const product = await Product.findById(id);
        productItem.quantity = quantity;
      } else {
        res.status(400);
        throw new Error("Product is not in the cart");
      }
      cart = await cart.save();
      return res.status(201).send(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong");
  }
});

// Delete Product
const deleteCartItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // console.log("Hello world");
  // console.log("parameter sent",req.params);
  try {
    let cart = await Cart.findOne({ business: req.business._id });

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
      return res.status(201).send(cart);
    } else {
      res.status(400);
      throw new Error("Cannot find your cart");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong");
  }
});

const getSales = asyncHandler(async (req, res) => {
  const query = req.query.query.toLowerCase();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const skip = (page - 1) * limit;

  const today = moment();
  let startDate = moment(today);

  const q = query.match(/(\d+)|([a-zA-Z]+)/g);

  switch (q[1]) {
    case "d":
      startDate.subtract(q[0], "days");
      break;
    case "m":
      startDate.subtract(q[0], "months");
      break;
    case "y":
      startDate.subtract(q[0], "years");
      break;
    default:
      startDate.subtract(7, "days");
  }

  const filter = {
    business: req.business.id,
    createdAt: {
      $gte: startDate.toDate(),
      $lt: today.toDate(),
    },
  };

  // Add search filter for product name or customer
  if (search) {
    filter.$or = [
      { "products.name": { $regex: search, $options: "i" } },
      { customer: { $regex: search, $options: "i" } },
      { paymentMethod: { $regex: search, $options: "i" } },
    ];
  }

  const total = await Sales.countDocuments(filter);
  const sales = await Sales.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    sales,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
  });
});

const getSale = asyncHandler(async (req, res) => {
  const sale = await Sales.findById(req.params.id);

  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }
  // Match product to its business
  if (sale.business.toString() !== req.business.id) {
    res.status(401);
    throw new Error("Business not authorized");
  }
  res.status(200).json(sale);
});

// Get all Products
// Get all available filter options
const getFilterOptions = asyncHandler(async (req, res) => {
  const businessId = req.business.id;

  // Get all unique categories
  const categories = await Product.distinct("category", {
    business: businessId,
    category: { $exists: true, $ne: null, $ne: "" },
  });

  // Get all unique warehouses
  const warehouses = await Product.distinct("warehouse", {
    business: businessId,
    warehouse: { $exists: true, $ne: null, $ne: "" },
  });

  res.status(200).json({
    categories: categories.filter(Boolean).sort(),
    warehouses: warehouses.filter(Boolean).sort(),
  });
});

const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const category = req.query.category ? req.query.category.split(",") : [];
  const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];
  const priceRange = req.query.priceRange
    ? req.query.priceRange.split(",")
    : [];
  const skip = (page - 1) * limit;

  let filter = { business: req.business.id };

  // Add search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { warehouse: { $regex: search, $options: "i" } },
    ];
  }

  // Add category filter
  if (category.length > 0) {
    filter.category = { $in: category };
  }

  // Add warehouse filter
  if (warehouse.length > 0) {
    filter.warehouse = { $in: warehouse };
  }

  // Add price range filter
  if (priceRange.length > 0) {
    const priceConditions = [];
    priceRange.forEach((range) => {
      if (range === "0-50") {
        priceConditions.push({ price: { $gte: 0, $lte: 50 } });
      } else if (range === "50-100") {
        priceConditions.push({ price: { $gte: 50, $lte: 100 } });
      } else if (range === "100-500") {
        priceConditions.push({ price: { $gte: 100, $lte: 500 } });
      } else if (range === "500+") {
        priceConditions.push({ price: { $gte: 500 } });
      }
    });
    if (priceConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: priceConditions });
    }
  }

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);
  const enrichedProducts = await enrichProductsWithRecordedSalesDiscounts({
    businessId: req.business.id,
    products,
  });

  // Calculate aggregated statistics for ALL filtered products
  const allFilteredProducts = await Product.find(filter).select(
    "price cost quantity",
  );

  let aggregatedStats = {
    totalValue: 0,
    totalCost: 0,
    totalQuantity: 0,
    totalProducts: total,
  };

  allFilteredProducts.forEach((product) => {
    const qty = product.quantity || 0;
    aggregatedStats.totalValue += (product.price || 0) * qty;
    aggregatedStats.totalCost += (product.cost || 0) * qty;
    aggregatedStats.totalQuantity += qty;
  });

  res.status(200).json({
    products: enrichedProducts,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    total,
    hasMore: page * limit < total,
    aggregatedStats,
  });
});

/**
 * Bulk fetch products for client-side pagination
 * Fetches all products (or up to MAX_BULK_LIMIT) in a single request
 * This enables state-driven pagination without backend calls per page
 *
 * Use case: Initial data load to enable client-side pagination and search
 */
const getProductsBulk = asyncHandler(async (req, res) => {
  const MAX_BULK_LIMIT = 1000; // Maximum products to return in bulk
  const limit = Math.min(
    parseInt(req.query.limit) || MAX_BULK_LIMIT,
    MAX_BULK_LIMIT,
  );
  const category = req.query.category ? req.query.category.split(",") : [];
  const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];

  console.log("[ProductController] getProductsBulk request:", {
    businessId: req.business?.id,
    limit,
    category,
    warehouse,
  });

  let filter = { business: req.business.id };

  // Add category filter
  if (category.length > 0) {
    filter.category = { $in: category };
  }

  // Add warehouse filter
  if (warehouse.length > 0) {
    filter.warehouse = { $in: warehouse };
  }

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort("-createdAt")
    .limit(limit)
    .lean(); // lean() for performance - returns plain objects
  const enrichedProducts = await enrichProductsWithRecordedSalesDiscounts({
    businessId: req.business.id,
    products,
  });

  console.log(
    `[ProductController] Bulk result: ${enrichedProducts.length} items, total in DB: ${total}`,
  );

  // Calculate aggregated statistics
  const aggregatedStats = {
    totalValue: 0,
    totalCost: 0,
    totalQuantity: 0,
    totalProducts: total,
  };

  enrichedProducts.forEach((product) => {
    const qty = product.quantity || 0;
    aggregatedStats.totalValue += (product.price || 0) * qty;
    aggregatedStats.totalCost += (product.cost || 0) * qty;
    aggregatedStats.totalQuantity += qty;
  });

  res.status(200).json({
    products: enrichedProducts,
    total,
    loaded: enrichedProducts.length,
    isComplete: enrichedProducts.length >= total,
    hasMore: enrichedProducts.length < total,
    aggregatedStats,
  });
});

// Get products with cursor-based pagination
// More efficient for large datasets and realtime updates
const getProductsCursor = asyncHandler(async (req, res) => {
  const { paginate } = require("../utils/cursorPagination");

  const cursor = req.query.cursor || null;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const category = req.query.category ? req.query.category.split(",") : [];
  const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];
  const priceRange = req.query.priceRange
    ? req.query.priceRange.split(",")
    : [];

  let filter = { business: req.business.id };

  // Add search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { warehouse: { $regex: search, $options: "i" } },
    ];
  }

  // Add category filter
  if (category.length > 0) {
    filter.category = { $in: category };
  }

  // Add warehouse filter
  if (warehouse.length > 0) {
    filter.warehouse = { $in: warehouse };
  }

  // Add price range filter
  if (priceRange.length > 0) {
    const priceConditions = [];
    priceRange.forEach((range) => {
      if (range === "0-50") {
        priceConditions.push({ price: { $gte: 0, $lte: 50 } });
      } else if (range === "50-100") {
        priceConditions.push({ price: { $gte: 50, $lte: 100 } });
      } else if (range === "100-500") {
        priceConditions.push({ price: { $gte: 100, $lte: 500 } });
      } else if (range === "500+") {
        priceConditions.push({ price: { $gte: 500 } });
      }
    });
    if (priceConditions.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: priceConditions });
    }
  }

  const result = await paginate(Product, filter, {
    cursor,
    limit,
    sortField: "createdAt",
    sortDirection: -1,
  });
  const enrichedCursorProducts = await enrichProductsWithRecordedSalesDiscounts({
    businessId: req.business.id,
    products: result.data,
  });

  // Calculate aggregated statistics
  const allFilteredProducts = await Product.find(filter).select(
    "price cost quantity",
  );

  let aggregatedStats = {
    totalValue: 0,
    totalCost: 0,
    totalQuantity: 0,
    totalProducts: result.pagination.total,
  };

  allFilteredProducts.forEach((product) => {
    const qty = product.quantity || 0;
    aggregatedStats.totalValue += (product.price || 0) * qty;
    aggregatedStats.totalCost += (product.cost || 0) * qty;
    aggregatedStats.totalQuantity += qty;
  });

  res.status(200).json({
    products: enrichedCursorProducts,
    pagination: result.pagination,
    total: result.pagination.total,
    hasMore: result.pagination.hasMore,
    aggregatedStats,
  });
});

// Get all Products
const getOutOfStock = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const category = req.query.category ? req.query.category.split(",") : [];
    const warehouse = req.query.warehouse ? req.query.warehouse.split(",") : [];
    const skip = (page - 1) * limit;

    const productsFilter = {
      quantity: 0,
      business: req.business.id,
    };

    const productGroupsFilter = {
      business: req.business.id,
      $expr: { $lte: [{ $size: "$combinations" }, 0] },
    };

    // Add search to filters
    if (search) {
      productsFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
      productGroupsFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Add category filter
    if (category.length > 0) {
      productsFilter.category = { $in: category };
      productGroupsFilter.category = { $in: category };
    }

    // Add warehouse filter
    if (warehouse.length > 0) {
      productsFilter.warehouse = { $in: warehouse };
      productGroupsFilter.warehouse = { $elemMatch: { $in: warehouse } };
    }

    const productsTotal = await Product.countDocuments(productsFilter);
    const productGroupsTotal =
      await ProductGroup.countDocuments(productGroupsFilter);

    const products = await Product.find(productsFilter)
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    const productGroups = await ProductGroup.find(productGroupsFilter)
      .sort("-createdAt")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      products: {
        data: products,
        currentPage: page,
        totalPages: Math.ceil(productsTotal / limit),
        total: productsTotal,
        hasMore: page * limit < productsTotal,
      },
      productGroups: {
        data: productGroups,
        currentPage: page,
        totalPages: Math.ceil(productGroupsTotal / limit),
        total: productGroupsTotal,
        hasMore: page * limit < productGroupsTotal,
      },
    });
  } catch (error) {
    console.error("[ProductsDashboardStats] request_failed", {
      businessId: String(req.business?._id || req.business?.id || "unknown"),
      loggedInUser: req.loggedInUser || "",
      message: error?.message || "Unknown dashboard stats error",
      stack: error?.stack || "",
    });
    res.status(400).json({ message: error.message });
  }
});

// Get single product
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  // if product doesnt exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // Match product to its Business
  if (product.business.toString() !== req.business.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  const enrichedProduct = await enrichProductWithRecordedSalesDiscount({
    businessId: req.business.id,
    product,
  });
  res.status(200).json(enrichedProduct);
});

// Delete Product
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  // if product doesnt exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // Match product to its user
  if (product.business.toString() !== req.business.id) {
    res.status(401);
    throw new Error("User not authorized");
  }
  
  // Store product data before deletion for event emission
  const deletedProductData = {
    _id: product._id,
    name: product.name,
    sku: product.sku,
    itemGroup: product.itemGroup,
  };
  
  await product.remove();
  res.status(200).json({ 
    message: "Product deleted.",
    ...deletedProductData 
  });
});

// Delete product Group
const deleteProductGroup = asyncHandler(async (req, res) => {
  const productgroup = await ProductGroup.findById(req.params.id);
  // if product doesnt exist
  if (!productgroup) {
    res.status(404);
    throw new Error("Group not found");
  }
  // Match product to its user
  if (productgroup.business.toString() !== req.business.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Store product group data before deletion for event emission
  const deletedGroupData = {
    _id: productgroup._id,
    groupName: productgroup.groupName,
  };

  if (productgroup) {
    Product.deleteMany({ itemGroup: productgroup?._id }, (err, data) => {
      if (err) {
        console.error("Error deleting documents:", err);
      } else {
        console.log("Documents deleted successfully!", data);
      }
    });
  }

  await productgroup.remove();
  res.status(200).json({ 
    message: "Group deleted.",
    ...deletedGroupData 
  });
});

// Update Product
const updateProduct = asyncHandler(async (req, res) => {
  const { name, category, quantity, price, cost, description, warehouse } =
    req.body;
  const { id } = req.params;
  const product = await Product.findById(id);

  let images = [];
  const uploadedFiles = Array.isArray(req.files)
    ? req.files
    : req.file
      ? [req.file]
      : [];
  const imageFiles = uploadedFiles.filter((file) => file.fieldname === "image");

  if (imageFiles.length > 0) {
    for (const imageFile of imageFiles) {
      try {
        const metadata = await uploadFileAndBuildMetadata(imageFile, req.business.id);
        images.push(metadata);
      } catch (error) {
        console.error("Image upload failed:", error.message);
      }
    }
  }

  const hasExistingImagesPayload = typeof req.body.existingImages !== "undefined";
  const payloadExistingImages = parseJsonArrayField(req.body.existingImages, []);

  // if product doesnt exist
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  // Match product to its business
  if (product.business.toString() !== req.business.id) {
    res.status(401);
    throw new Error("User not authorized");
  }

  try {
    // let updatedProduct;

    const preservedImages = hasExistingImagesPayload
      ? toImageArray(payloadExistingImages, {})
      : toImageArray(product.images, product.image);
    const finalImages = [...preservedImages, ...images];

    const updates = {
      name,
      category,
      quantity: Number(quantity),
      warehouse,
      price: Number(price),
      cost: Number(cost),
      description,
      images: finalImages,
      image: finalImages[0] || {},
    };

    const oldQuantity = product.quantity;
    const newQuantity = Number(quantity);
    const quantityChange = newQuantity - oldQuantity;

    // Initialize history if it doesn't exist
    if (!product.history) {
      product.history = [];
      product.totalStocked = 0;
      product.totalSold = 0;
      product.totalRevenue = 0;
    }

    // If this is the first edit (history is empty), initialize totalStocked with current quantity
    //

    // Add history entry for quantity change
    if (quantityChange !== 0) {
      const historyType = quantityChange > 0 ? "stock-in" : "adjustment";
      const historyEntry = {
        date: new Date(),
        type: historyType,
        quantityChange,
        balance: newQuantity,
        performedBy:
          (req.user && (req.user.name || req.user.email)) ||
          (req.body.user && (req.body.user.name || req.body.user.email)) ||
          "system",
        note: "",
      };
      product.history.push(historyEntry);

      // Update totalStocked
      if (quantityChange > 0) {
        product.totalStocked += quantityChange;
      } else {
        // Also deduct when quantity is reduced
        product.totalStocked += quantityChange;
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      { _id: id },
      {
        ...updates,
        history: product.history,
        totalStocked: product.totalStocked,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // Calculate and update sales metrics
    const metrics = await calculateProductSalesMetrics(id);
    await Product.findByIdAndUpdate(id, {
      totalSold: metrics.totalSold,
      totalRevenue: metrics.totalRevenue,
    });

    // Log activity to include what changed in the product
    const changes = [];
    for (const key in updates) {
      if (!deepEqual(product[key], updates[key])) {
        const oldVal = product[key];
        const newVal = updates[key];

        if (key === "quantity") {
          const diff = newVal - oldVal;
          if (diff > 0) {
            changes.push(
              `increased stock by ${diff} units (${oldVal} → ${newVal})`,
            );
          } else {
            changes.push(
              `decreased stock by ${Math.abs(
                diff,
              )} units (${oldVal} → ${newVal})`,
            );
          }
        } else if (key === "price") {
          changes.push(
            `updated price from ₦${oldVal.toLocaleString()} to ₦${newVal.toLocaleString()}`,
          );
        } else if (key === "cost") {
          changes.push(
            `updated cost from ₦${oldVal.toLocaleString()} to ₦${newVal.toLocaleString()}`,
          );
        } else if (key === "category") {
          changes.push(`changed category from "${oldVal}" to "${newVal}"`);
        } else if (key === "warehouse") {
          changes.push(`moved from warehouse "${oldVal}" to "${newVal}"`);
        } else if (key === "name") {
          changes.push(`renamed from "${oldVal}" to "${newVal}"`);
        } else if (key === "description") {
          changes.push("updated product description");
        } else {
          changes.push(`updated ${key}`);
        }
      }
    }

    const activity =
      changes.length > 0
        ? `Updated product "${name}": ${changes.join(", ")}`
        : `Updated product "${name}"`;

    logActivity(activity)(req, res);

    res.status(200).json(updatedProduct);
  } catch (error) {
    // console.error("Error editing product:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getTopSellingProducts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const pipelineProducts = [
      { $unwind: "$items" },
      { $match: { business: mongoose.Types.ObjectId(req.business._id) } },
      {
        $group: {
          _id: "$items.id",
          name: { $first: "$items.name" },
          business: { $first: "$business" },
          total_sales: { $sum: "$items.quantity" },
        },
      },
      { $sort: { total_sales: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$productId"] },
                    { $eq: ["$productIsaGroup", false] },
                  ],
                },
              },
            },
          ],
          as: "product_details",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          total_sales: 1,
          product_details: { $arrayElemAt: ["$product_details", 0] },
        },
      },
    ];

    const pipelineProductGroups = [
      { $unwind: "$items" },
      { $match: { business: mongoose.Types.ObjectId(req.business._id) } },
      {
        $group: {
          _id: { $toObjectId: "$items.itemGroup" },
          business: { $first: "$business" },
          total_sales: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { total_sales: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "productgroups",
          localField: "_id",
          foreignField: "_id",
          as: "group_details",
        },
      },
      {
        $project: {
          _id: 1,
          total_sales: 1,
          group_details: 1,
          name: { $arrayElemAt: ["$group_details.groupName", 0] },
        },
      },
    ];

    const countPipelineProducts = [
      { $unwind: "$items" },
      { $match: { business: mongoose.Types.ObjectId(req.business._id) } },
      {
        $group: {
          _id: "$items.id",
        },
      },
      { $count: "total" },
    ];

    const countPipelineProductGroups = [
      { $unwind: "$items" },
      { $match: { business: mongoose.Types.ObjectId(req.business._id) } },
      {
        $group: {
          _id: { $toObjectId: "$items.itemGroup" },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $count: "total" },
    ];

    const products = await CheckOut.aggregate(pipelineProducts);
    const productGroups = await CheckOut.aggregate(pipelineProductGroups);
    const productsCount = await CheckOut.aggregate(countPipelineProducts);
    const productGroupsCount = await CheckOut.aggregate(
      countPipelineProductGroups,
    );

    const productsTotal = productsCount[0]?.total || 0;
    const productGroupsTotal = productGroupsCount[0]?.total || 0;

    res.status(200).json({
      products: {
        data: products,
        currentPage: page,
        totalPages: Math.ceil(productsTotal / limit),
        total: productsTotal,
        hasMore: page * limit < productsTotal,
      },
      productGroups: {
        data: productGroups,
        currentPage: page,
        totalPages: Math.ceil(productGroupsTotal / limit),
        total: productGroupsTotal,
        hasMore: page * limit < productGroupsTotal,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getLowProducts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const pipelineProducts = [
      {
        $match: {
          productIsaGroup: false,
        },
      },
      {
        $group: {
          _id: { business: "$business", _id: "$_id" },
          product_quantity: { $sum: { $toInt: "$quantity" } },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id._id",
          foreignField: "_id",
          as: "products",
        },
      },
      {
        $match: {
          $and: [
            { "_id.business": { $exists: true } },
            { "_id.business": mongoose.Types.ObjectId(req.business._id) },
            { product_quantity: { $gt: 0, $lt: 5 } },
          ],
        },
      },
      {
        $sort: {
          product_quantity: -1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const pipelineProductGroups = [
      {
        $group: {
          _id: { business: "$business", _id: "$_id" },
          product_quantity: { $sum: { $size: "$combinations" } },
        },
      },
      {
        $lookup: {
          from: "productgroups",
          localField: "_id._id",
          foreignField: "_id",
          as: "product_group_details",
        },
      },
      {
        $match: {
          $and: [
            { "_id.business": { $exists: true } },
            { "_id.business": mongoose.Types.ObjectId(req.business._id) },
            { product_quantity: { $gt: 0, $lt: 5 } },
          ],
        },
      },
      {
        $sort: { product_quantity: -1 },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const countPipelineProducts = [
      {
        $match: {
          productIsaGroup: false,
        },
      },
      {
        $group: {
          _id: { business: "$business", _id: "$_id" },
          product_quantity: { $sum: { $toInt: "$quantity" } },
        },
      },
      {
        $match: {
          $and: [
            { "_id.business": { $exists: true } },
            { "_id.business": mongoose.Types.ObjectId(req.business._id) },
            { product_quantity: { $gt: 0, $lt: 5 } },
          ],
        },
      },
      { $count: "total" },
    ];

    const countPipelineProductGroups = [
      {
        $group: {
          _id: { business: "$business", _id: "$_id" },
          product_quantity: { $sum: { $size: "$combinations" } },
        },
      },
      {
        $match: {
          $and: [
            { "_id.business": { $exists: true } },
            { "_id.business": mongoose.Types.ObjectId(req.business._id) },
            { product_quantity: { $gt: 0, $lt: 5 } },
          ],
        },
      },
      { $count: "total" },
    ];

    const products = await Product.aggregate(pipelineProducts);
    const productGroups = await ProductGroup.aggregate(pipelineProductGroups);
    const productsCount = await Product.aggregate(countPipelineProducts);
    const productGroupsCount = await ProductGroup.aggregate(
      countPipelineProductGroups,
    );

    const productsTotal = productsCount[0]?.total || 0;
    const productGroupsTotal = productGroupsCount[0]?.total || 0;

    res.status(200).json({
      products: {
        data: products,
        currentPage: page,
        totalPages: Math.ceil(productsTotal / limit),
        total: productsTotal,
        hasMore: page * limit < productsTotal,
      },
      productGroups: {
        data: productGroups,
        currentPage: page,
        totalPages: Math.ceil(productGroupsTotal / limit),
        total: productGroupsTotal,
        hasMore: page * limit < productGroupsTotal,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getSalesByYear = asyncHandler(async (req, res) => {
  let yearId = req.params.id;
  let year = Number(yearId);

  const pipeline = [
    {
      $unwind: "$items",
    },
    {
      $project: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        quantity: { $toInt: "$items.quantity" },
        cost: { $toDouble: "$items.cost" },
        price: { $toDouble: "$items.price" },
        business: "$business",
      },
    },
    {
      $match: {
        $and: [
          { business: { $exists: true } },
          { business: mongoose.Types.ObjectId(req.business._id) },
          { year: year },
        ],
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
    {
      $sort: {
        "_id.month": 1,
      },
    },
  ];

  // Get expenses by month for the same year
  const expensePipeline = [
    {
      $project: {
        year: { $year: "$date" },
        month: { $month: "$date" },
        amount: "$amount",
        business: "$business",
      },
    },
    {
      $match: {
        business: mongoose.Types.ObjectId(req.business._id),
        year: year,
      },
    },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        totalExpenses: { $sum: "$amount" },
      },
    },
    {
      $sort: {
        "_id.month": 1,
      },
    },
  ];

  try {
    const salesResult = await CheckOut.aggregate(pipeline);
    const expenseResult = await Expense.aggregate(expensePipeline);

    // Merge sales and expense data
    const mergedData = salesResult.map((sale) => {
      const expense = expenseResult.find(
        (exp) =>
          exp._id.year === sale._id.year && exp._id.month === sale._id.month,
      );
      const totalExpenses = expense ? expense.totalExpenses : 0;
      const grossProfit = sale.totalProfit - totalExpenses;

      return {
        _id: sale._id,
        totalSales: sale.totalSales,
        totalProfit: sale.totalProfit,
        totalExpenses: totalExpenses,
        grossProfit: grossProfit,
      };
    });

    // Add months with only expenses (no sales)
    expenseResult.forEach((expense) => {
      const existsInSales = mergedData.find(
        (data) =>
          data._id.year === expense._id.year &&
          data._id.month === expense._id.month,
      );
      if (!existsInSales) {
        mergedData.push({
          _id: expense._id,
          totalSales: 0,
          totalProfit: 0,
          totalExpenses: expense.totalExpenses,
          grossProfit: -expense.totalExpenses,
        });
      }
    });

    // Sort by month
    mergedData.sort((a, b) => a._id.month - b._id.month);

    res.status(200).json({ data: mergedData });
  } catch (err) {
    res.status(400).json({ err: err.message });
  }
});

// Get Dashboard Statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const startedAt = process.hrtime.bigint();
    const businessId = req.business.id;
    const businessObjectId = mongoose.Types.ObjectId(businessId);

    const [productAgg, groupAgg, expenseAgg] = await Promise.all([
      Product.aggregate([
        { $match: { business: businessObjectId } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalProducts: { $sum: 1 },
                  outOfStockSingleProducts: {
                    $sum: {
                      $cond: [
                        {
                          $lte: [
                            {
                              $convert: {
                                input: { $ifNull: ["$quantity", 0] },
                                to: "double",
                                onError: 0,
                                onNull: 0,
                              },
                            },
                            0,
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  totalStoreValueByPrice: {
                    $sum: {
                      $multiply: [
                        {
                          $convert: {
                            input: { $ifNull: ["$price", 0] },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        {
                          $convert: {
                            input: { $ifNull: ["$quantity", 0] },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                      ],
                    },
                  },
                  totalStoreValueByCost: {
                    $sum: {
                      $multiply: [
                        {
                          $convert: {
                            input: { $ifNull: ["$cost", 0] },
                            to: "double",
                            onError: 0,
                            onNull: 0,
                          },
                        },
                        {
                          $convert: {
                            input: { $ifNull: ["$quantity", 0] },
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
            ],
            categories: [
              {
                $match: {
                  category: { $type: "string", $ne: "" },
                },
              },
              {
                $group: {
                  _id: { $trim: { input: "$category" } },
                },
              },
              {
                $match: { _id: { $ne: "" } },
              },
              { $count: "totalCategories" },
            ],
          },
        },
      ]),
      ProductGroup.aggregate([
        { $match: { business: businessObjectId } },
        {
          $group: {
            _id: null,
            totalProductGroups: { $sum: 1 },
            outOfStockGroupProducts: {
              $sum: {
                $cond: [
                  { $lte: [{ $size: { $ifNull: ["$combinations", []] } }, 0] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { business: businessObjectId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const productSummary = productAgg?.[0]?.summary?.[0] || {};
    const categorySummary = productAgg?.[0]?.categories?.[0] || {};
    const groupSummary = groupAgg?.[0] || {};
    const expenseSummary = expenseAgg?.[0] || {};

    const totalProducts = Number(productSummary.totalProducts || 0);
    const totalProductGroups = Number(groupSummary.totalProductGroups || 0);
    const totalCategories = Number(categorySummary.totalCategories || 0);
    const outOfStockSingleProducts = Number(
      productSummary.outOfStockSingleProducts || 0,
    );
    const outOfStockGroupProducts = Number(
      groupSummary.outOfStockGroupProducts || 0,
    );
    const totalStoreValueByPrice = Number(
      productSummary.totalStoreValueByPrice || 0,
    );
    const totalStoreValueByCost = Number(
      productSummary.totalStoreValueByCost || 0,
    );
    const totalExpenses = Number(expenseSummary.total || 0);

    const durationMs = Number(
      (Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(2),
    );

    console.info("[ProductsDashboardStats] request_timing", {
      businessId: String(businessId),
      durationMs,
      totals: {
        totalProducts,
        totalProductGroups,
        totalCategories,
      },
    });

    res.status(200).json({
      totalProducts: totalProducts,
      totalCategories,
      outOfStock: {
        singleProducts: outOfStockSingleProducts,
        groupProducts: outOfStockGroupProducts,
        total: outOfStockSingleProducts + outOfStockGroupProducts,
      },
      storeValue: {
        byPrice: totalStoreValueByPrice,
        byCost: totalStoreValueByCost,
      },
      totalExpenses,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * Batch Delete Products
 * 
 * REALTIME ARCHITECTURE:
 * This operation emits MULTIPLE events to ensure realtime synchronization:
 * 1. CART_UPDATED: Explicitly emitted for each affected cart (via WebSocket)
 *    - Fired IMMEDIATELY after cart items are removed
 *    - Ensures frontend receives cart update without waiting for change stream
 *    - Includes updated cart data (items, totals, user info)
 * 
 * 2. PRODUCT_GROUP_UPDATED: Emitted for each affected product group
 *    - Updates product group metadata after variants are removed
 *    - Frontend updates bulk cache with new group state
 * 
 * 3. PRODUCT_DELETED: Emitted for the deleted products
 *    - Triggers product cache removal on frontend
 *    - Updates out-of-stock inventory
 * 
 * FALLBACK: If explicit events fail, MongoDB Change Streams will detect:
 *   - Cart collection updates → emits CART_UPDATED via change stream
 *   - This provides redundancy; idempotency check prevents duplicate processing
 * 
 * NO POLLING: Frontend must NOT call getCart() after batch delete
 * All updates flow through WebSocket/SSE realtime events ONLY
 */
const batchDeleteProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400);
    throw new Error("Please provide an array of product IDs");
  }

  // Verify all products belong to this business
  const products = await Product.find({
    _id: { $in: productIds },
    business: req.business.id,
  });

  if (products.length !== productIds.length) {
    res.status(401);
    throw new Error("Some products not found or not authorized");
  }

  // Group products by itemGroup (product group they belong to)
  const groupMemberships = new Map(); // itemGroup -> [{ _id, name }]
  
  for (const product of products) {
    if (product.itemGroup) {
      const groupId = product.itemGroup.toString();
      if (!groupMemberships.has(groupId)) {
        groupMemberships.set(groupId, []);
      }
      groupMemberships.get(groupId).push({
        _id: product._id.toString(),
        name: product.name, // Product name should match combination string
      });
    }
  }

  // Delete products from their product groups and update group metadata
  const updatedGroups = []; // Track updated product groups for events
  
  for (const [groupId, productsToRemove] of groupMemberships) {
    const productGroup = await ProductGroup.findById(groupId);
    
    console.log(`[BatchDelete] Processing group ${groupId} with ${productsToRemove.length} product(s) to delete`);
    console.log(`[BatchDelete] Product names to remove:`, productsToRemove.map(p => p.name));
    console.log(`[BatchDelete] Current combinations:`, productGroup?.combinations);

    if (productGroup && productGroup.business.toString() === req.business.id) {
      // Find ALL indices of products to remove by matching product names
      const indicesToRemove = new Set();
      
      for (const productToRemove of productsToRemove) {
        // Find which indices in combinations array match this product
        // Note: Use indexOf to find ALL matches, handle duplicates properly
        let searchIndex = 0;
        while (searchIndex < productGroup.combinations.length) {
          const foundIndex = productGroup.combinations.indexOf(
            productToRemove.name,
            searchIndex
          );
          
          if (foundIndex === -1) break; // No more matches
          
          indicesToRemove.add(foundIndex);
          console.log(`[BatchDelete] Product "${productToRemove.name}" found at index ${foundIndex}`);
          
          searchIndex = foundIndex + 1; // Continue searching after this index
        }
        
        if (indicesToRemove.size === 0) {
          console.warn(`[BatchDelete] Product "${productToRemove.name}" not found in combinations`);
        }
      }

      if (indicesToRemove.size > 0) {
        // Sort indices in descending order (for logging purposes)
        const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
        
        console.log(`[BatchDelete] Removing indices (in order):`, sortedIndices);

        // Remove from all arrays at once using filter pattern
        // This is safer than splice and mirrors handleDeleteCombination's approach
        productGroup.combinations = productGroup.combinations.filter(
          (_, i) => !indicesToRemove.has(i)
        );
        
        if (Array.isArray(productGroup.sku)) {
          productGroup.sku = productGroup.sku.filter((_, i) => !indicesToRemove.has(i));
        }
        
        if (Array.isArray(productGroup.price)) {
          productGroup.price = productGroup.price.filter((_, i) => !indicesToRemove.has(i));
        }
        
        if (Array.isArray(productGroup.cost)) {
          productGroup.cost = productGroup.cost.filter((_, i) => !indicesToRemove.has(i));
        }
        
        if (Array.isArray(productGroup.warehouse)) {
          productGroup.warehouse = productGroup.warehouse.filter(
            (_, i) => !indicesToRemove.has(i)
          );
        }
        
        if (Array.isArray(productGroup.quantity)) {
          productGroup.quantity = productGroup.quantity.filter(
            (_, i) => !indicesToRemove.has(i)
          );
        }
        
        if (Array.isArray(productGroup.combinationImages)) {
          productGroup.combinationImages = productGroup.combinationImages.filter(
            (_, i) => !indicesToRemove.has(i)
          );
        }

        // Update options if it exists (handle product variants with unique attributes)
        if (productGroup.isProductUnique && Array.isArray(productGroup.options)) {
          const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
          productGroup.options = productGroup.options.map((optionGroup) => {
            const attr = Array.isArray(optionGroup.attr)
              ? [...optionGroup.attr]
              : [];

            sortedIndices.forEach((idx) => {
              const targetIndex = idx + 1;
              if (targetIndex >= 0 && targetIndex < attr.length) {
                attr.splice(targetIndex, 1);
              }
            });

            return {
              ...optionGroup,
              attr,
            };
          });
        }

        // Mark arrays as modified for Mongoose
        productGroup.markModified('combinations');
        productGroup.markModified('sku');
        productGroup.markModified('price');
        productGroup.markModified('cost');
        productGroup.markModified('warehouse');
        productGroup.markModified('quantity');
        productGroup.markModified('combinationImages');
        productGroup.markModified('options');

        // Save the updated group
        await productGroup.save();
        
        console.log(`[BatchDelete] Updated group ${groupId}. Remaining combinations:`, productGroup.combinations);
        
        // Track for event emission
        updatedGroups.push(productGroup);
      }
    }
  }

  // Remove products from all shopping carts BEFORE deleting them
  // Also track which carts were updated to emit realtime CART_UPDATED events
  const affectedCarts = [];
  
  if (productIds.length > 0) {
    try {
      // Fetch affected carts before updating (to send realtime updates)
      const cartsToUpdate = await Cart.find({
        business: req.business._id,
        'items.id': { $in: productIds }
      });
      
      // Store original carts for comparison
      affectedCarts.push(...cartsToUpdate.map(cart => ({
        _id: cart._id,
        userId: cart.user?.email,
        originalItems: [...(cart.items || [])]
      })));
      
      // Now remove the products from carts
      const updateResult = await Cart.updateMany(
        { business: req.business._id },
        {
          $pull: {
            items: {
              id: { $in: productIds } // ids are stored as strings in cart
            }
          }
        }
      );
      
      console.log(`[BatchDelete] Removed ${productIds.length} product(s) from ${updateResult.modifiedCount} cart(s)`);
      
      // Fetch updated carts to send realtime updates
      if (affectedCarts.length > 0) {
        const updatedCarts = await Cart.find({
          _id: { $in: affectedCarts.map(c => c._id) }
        });
        
        // Emit CART_UPDATED events for each affected cart via WebSocket
        updatedCarts.forEach((updatedCart) => {
          eventBus.emitBusinessEvent(
            EventTypes.CART_UPDATED,
            req.business.id.toString(),
            {
              _id: updatedCart._id,
              cartId: updatedCart._id,
              items: updatedCart.items,
              itemCount: updatedCart.items?.length || 0,
              totalValue: updatedCart.total,
              user: updatedCart.user,
              userId: updatedCart.user?.email,
              lastUpdated: updatedCart.updatedAt,
            },
            { source: "batch_delete", operation: "batch-delete" }
          );
        });
        
        console.log(`[BatchDelete] Emitted CART_UPDATED events for ${updatedCarts.length} cart(s)`);
      }
    } catch (cartError) {
      console.error(`[BatchDelete] Error removing products from carts:`, cartError.message);
      // Don't fail the entire operation if cart update fails
    }
  }

  // Emit PRODUCT_GROUP_UPDATED events for affected product groups
  if (updatedGroups.length > 0) {
    updatedGroups.forEach((group) => {
      eventBus.emitBusinessEvent(
        EventTypes.PRODUCT_GROUP_UPDATED,
        req.business.id.toString(),
        {
          _id: group._id,
          groupName: group.groupName,
          combinations: group.combinations,
          sku: group.sku,
          price: group.price,
          cost: group.cost,
          warehouse: group.warehouse,
          quantity: group.quantity,
          combinationImages: group.combinationImages,
          options: group.options,
        },
        { source: "batch_delete" },
      );
    });
    
    console.log(`[BatchDelete] Emitted PRODUCT_GROUP_UPDATED events for ${updatedGroups.length} product group(s)`);
  }

  // Emit PRODUCT_DELETED event for deleted products (will be caught by eventMiddleware)
  eventBus.emitBusinessEvent(
    EventTypes.PRODUCT_DELETED,
    req.business.id.toString(),
    { products: products.map(p => ({ _id: p._id })) },
    { source: "batch_delete" }
  );

  // Delete the products
  const deleteResult = await Product.deleteMany({ _id: { $in: productIds } });

  console.log(`[BatchDelete] Deleted ${deleteResult.deletedCount} product(s)`);

  res.status(200).json({ 
    message: `${productIds.length} product(s) deleted successfully`,
    deletedCount: productIds.length,
    productIds: productIds, // Include for realtime event handling
    affectedCarts: affectedCarts.length,
  });
});

// Batch Toggle Products (on/off)
const batchToggleProducts = asyncHandler(async (req, res) => {
  const { productIds, listProduct } = req.body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400);
    throw new Error("Please provide an array of product IDs");
  }

  if (typeof listProduct !== "boolean") {
    res.status(400);
    throw new Error("Please provide a valid listProduct boolean value");
  }

  // Verify all products belong to this business
  const products = await Product.find({
    _id: { $in: productIds },
    business: req.business.id,
  });

  if (products.length !== productIds.length) {
    res.status(401);
    throw new Error("Some products not found or not authorized");
  }

  const groupIds = [
    ...new Set(
      products
        .map((product) => product.itemGroup)
        .filter(Boolean)
        .map((groupId) => groupId.toString()),
    ),
  ];

  const productGroups = groupIds.length
    ? await ProductGroup.find({ _id: { $in: groupIds } })
    : [];
  const productGroupMap = new Map(
    productGroups.map((group) => [group._id.toString(), group]),
  );

  // If turning on (listProduct = true), validate image requirements
  if (listProduct === true) {
    const invalidProducts = [];
    for (const product of products) {
      const group = product.itemGroup
        ? productGroupMap.get(product.itemGroup.toString())
        : null;
      const totalImages = countCombinedImages(product.images, group?.images);
      if (totalImages < 2) {
        invalidProducts.push({
          id: product._id,
          name: product.name,
          imageCount: totalImages,
        });
      }
    }

    if (invalidProducts.length > 0) {
      res.status(400);
      throw new Error(
        `Cannot turn on products with less than 2 images: ${invalidProducts.map((p) => p.name).join(", ")}`
      );
    }
  }

  // Update all products
  await Product.updateMany(
    { _id: { $in: productIds } },
    { $set: { listProduct } }
  );

  if (groupIds.length > 0) {
    const groupListingStates = await Promise.all(
      groupIds.map(async (groupId) => {
        const hasListedVariant = await Product.exists({
          business: req.business.id,
          itemGroup: groupId,
          listProduct: true,
        });

        return {
          groupId,
          listGroup: Boolean(hasListedVariant),
        };
      }),
    );

    await Promise.all(
      groupListingStates.map((state) =>
        ProductGroup.updateOne(
          { _id: state.groupId },
          { $set: { listGroup: state.listGroup } },
        ),
      ),
    );

    const updatedGroups = await ProductGroup.find({ _id: { $in: groupIds } });
    updatedGroups.forEach((group) => {
      const payload = group?.toObject ? group.toObject() : group;
      eventBus.emitBusinessEvent(
        EventTypes.PRODUCT_GROUP_UPDATED,
        req.business.id.toString(),
        payload,
        { source: "batch_toggle" },
      );
    });
  }

  res.status(200).json({
    message: `${productIds.length} product(s) ${listProduct ? "turned on" : "turned off"} successfully`,
    updatedCount: productIds.length,
    productIds: productIds, // Include for realtime event handling
    listProduct: listProduct,
  });
});

// Batch Delete Product Groups with cascade deletion of variants
const batchDeleteGroups = asyncHandler(async (req, res) => {
  const { groupIds } = req.body;

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    res.status(400);
    throw new Error("Please provide an array of product group IDs");
  }

  // Verify all groups belong to this business
  const groups = await ProductGroup.find({
    _id: { $in: groupIds },
    business: req.business.id,
  });

  if (groups.length !== groupIds.length) {
    res.status(401);
    throw new Error("Some groups not found or not authorized");
  }

  // Find all variant products for these groups
  const variantProducts = await Product.find({
    itemGroup: { $in: groupIds },
    business: req.business.id,
  });

  const variantProductIds = variantProducts.map((p) => p._id.toString());
  const variantCount = variantProducts.length;

  console.log(
    `[BatchDeleteGroups] Deleting ${groupIds.length} group(s) and ${variantCount} variant(s)`,
  );

  // Delete variant products first
  if (variantProductIds.length > 0) {
    await Product.deleteMany({ _id: { $in: variantProductIds } });
  }

  // Delete the product groups
  await ProductGroup.deleteMany({ _id: { $in: groupIds } });

  // Emit single bulk event for efficiency
  const { eventBus, EventTypes } = require("../events/EventEmitter");
  eventBus.emitBusinessEvent(
    EventTypes.PRODUCT_GROUP_BULK_DELETED,
    req.business.id.toString(),
    {
      deletedGroupIds: groupIds,
      deletedVariantIds: variantProductIds,
      groupCount: groupIds.length,
      variantCount: variantCount,
    },
    { source: "batch_delete_groups" },
  );

  res.status(200).json({
    message: `Deleted ${groupIds.length} group(s) and ${variantCount} variant(s) successfully`,
    groupCount: groupIds.length,
    variantCount: variantCount,
    deletedGroupIds: groupIds,
    deletedVariantIds: variantProductIds,
  });
});

module.exports = {
  createProduct,
  createMultipleProducts,
  updateProductGroup,
  getProducts,
  getProductsBulk,
  getProductsCursor,
  getFilterOptions,
  getProductGroups,
  getSalesByYear,
  getProduct,
  getLowProducts,
  getTopSellingProducts,
  deleteProduct,
  getCart,
  updateCart,
  deleteCartItem,
  updateProduct,
  deleteProductGroup,
  sellProduct,
  addToCart,
  getSales,
  getSale,
  getOutOfStock,
  getDashboardStats,
  batchDeleteProducts,
  batchDeleteGroups,
  batchToggleProducts,
  updateGroupListingOptions,
  // saveDraft,
  // getDraft,
};
