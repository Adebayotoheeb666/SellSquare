export const normalizeImageObject = (image) => {
  if (!image || typeof image !== "object") return null;
  if (!image.filePath) return null;
  return image;
};

export const normalizeImageArray = (images, legacyImage) => {
  if (Array.isArray(images)) {
    const normalized = images
      .map((image) => normalizeImageObject(image))
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }

  const normalizedLegacy = normalizeImageObject(legacyImage);
  return normalizedLegacy ? [normalizedLegacy] : [];
};

export const getPrimaryImagePath = (images, legacyImage) => {
  const imageList = normalizeImageArray(images, legacyImage);
  return imageList[0]?.filePath || "";
};

export const normalizeCombinationImageEntry = (entry) => {
  if (Array.isArray(entry)) {
    return entry.map((item) => normalizeImageObject(item)).filter(Boolean);
  }

  const normalized = normalizeImageObject(entry);
  return normalized ? [normalized] : [];
};

export const getImageIdentity = (image) => {
  if (!image || typeof image !== "object") return "";
  return image.filePath || image.fileName || JSON.stringify(image);
};

export const getCombinedImageCount = (productImages = [], groupImages = []) => {
  const combined = [
    ...(Array.isArray(productImages) ? productImages : []),
    ...(Array.isArray(groupImages) ? groupImages : []),
  ];
  const seen = new Set();

  combined.forEach((image) => {
    const key = getImageIdentity(image);
    if (key) {
      seen.add(key);
    }
  });

  return seen.size;
};
