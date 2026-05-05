const ADMIN_BUSINESS_IDS = [
  "660159fcb99e02f029328480",
  "653695a6bd920a2961002ccc",
  "695eb886f45c92aad6f2a444",
  "69f869e522a7677061145572",
  "69e2905ade9d0e028632af8c"
  
];

const normalizeBusinessId = (businessId) => {
  if (!businessId) return "";
  return String(businessId).trim();
};

const isAllowedAdminBusinessId = (businessId) =>
  ADMIN_BUSINESS_IDS.includes(normalizeBusinessId(businessId));

const hasAdminBusinessAccess = (business) => {
  if (!business) return false;
  return isAllowedAdminBusinessId(business.id || business._id);
};

module.exports = {
  ADMIN_BUSINESS_IDS,
  isAllowedAdminBusinessId,
  hasAdminBusinessAccess,
};
