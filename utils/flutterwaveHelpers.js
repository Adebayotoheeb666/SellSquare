/**
 * Flutterwave Bank Codes and Helpers
 * Provides utilities for bank code resolution for Flutterwave transfers API
 */

const NIGERIAN_BANKS = {
  "044": { code: "044", name: "Access Bank" },
  "050": { code: "050", name: "Ecobank Nigeria" },
  "011": { code: "011", name: "First Bank of Nigeria" },
  "070": { code: "070", name: "Zenith Bank" },
  "999": { code: "999", name: "GTBank" },
  "058": { code: "058", name: "Guaranty Trust Bank" },
  "066": { code: "066", name: "Skye Bank" },
  "012": { code: "012", name: "UBA (United Bank for Africa)" },
  "035": { code: "035", name: "Wema Bank" },
  "063": { code: "063", name: "Diamond Bank" },
  "076": { code: "076", name: "Stanbic IBTC Bank" },
  "037": { code: "037", name: "Sterling Bank" },
  "100": { code: "100", name: "FCMB" },
  "082": { code: "082", name: "Keystone Bank" },
  "089": { code: "089", name: "Jaiz Bank" },
  "090": { code: "090", name: "Ecobank Transnational Inc" },
  "059": { code: "059", name: "Fidelity Bank" },
  "060": { code: "060", name: "Heritage Bank" },
  "101": { code: "101", name: "Providus Bank" },
  "103": { code: "103", name: "Access Bank (Dormant Teaser)" },
  "104": { code: "104", name: "Globus Bank" },
  "105": { code: "105", name: "Maize Bank" },
  "107": { code: "107", name: "Titan Trust Bank" },
  "108": { code: "108", name: "Maliyo Solutions" },
  "301": { code: "301", name: "Fidelity Mobile Money" },
  "302": { code: "302", name: "GTCO Mobile Money" },
  "303": { code: "303", name: "Unified Payment" },
  "304": { code: "304", name: "Cellulant" },
  "305": { code: "305", name: "Eartholeum" },
  "900": { code: "900", name: "Fcmb Mobile Money" },
  "901": { code: "901", name: "USSD Service" },
  "100001": { code: "100001", name: "Kudi Microfinance Bank" },
  "100002": { code: "100002", name: "Adeyemi College of Education" },
  "100004": { code: "100004", name: "Beta Microfinance Bank" },
  "100006": { code: "100006", name: "Firmus MFB" },
  "100007": { code: "100007", name: "First Integrated Micro Deposit" },
  "100008": { code: "100008", name: "First Option Microfinance Bank" },
  "100009": { code: "100009", name: "FinaTrust Microfinance Bank" },
  "100010": { code: "100010", name: "First Bank of Nigeria Holdings" },
  "100019": { code: "100019", name: "Ogo Microfinance Bank" },
  "100020": { code: "100020", name: "OPCMFB" },
  "100021": { code: "100021", name: "Wema Bank Plc" },
};

/**
 * Get bank code by bank name
 * @param {string} bankName - The name of the bank
 * @returns {string|null} - The bank code or null if not found
 */
const getFlutterwaveBankCode = (bankName) => {
  if (!bankName) return null;

  // Case-insensitive search
  const entry = Object.values(NIGERIAN_BANKS).find(
    (b) => b.name.toLowerCase() === bankName.toLowerCase()
  );

  return entry?.code || null;
};

/**
 * Get bank name by bank code
 * @param {string} bankCode - The bank code
 * @returns {string|null} - The bank name or null if not found
 */
const getFlutterwaveBankName = (bankCode) => {
  return NIGERIAN_BANKS[bankCode]?.name || null;
};

/**
 * Get all Nigerian banks
 * @returns {object} - Object mapping bank codes to bank details
 */
const getNigerianBanks = () => {
  return NIGERIAN_BANKS;
};

/**
 * Get banks as array for dropdown/select options
 * @returns {array} - Array of {code, name} objects sorted by name
 */
const getBanksAsArray = () => {
  return Object.values(NIGERIAN_BANKS).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Validate bank details
 * @param {string} bankCode - The bank code
 * @param {string} accountNumber - The account number
 * @param {string} accountName - The account name
 * @returns {object} - {isValid: boolean, error: string|null}
 */
const validateBankDetails = (bankCode, accountNumber, accountName) => {
  if (!bankCode) {
    return { isValid: false, error: "Bank code is required" };
  }

  if (!NIGERIAN_BANKS[bankCode]) {
    return { isValid: false, error: "Invalid bank code" };
  }

  if (!accountNumber || accountNumber.trim().length === 0) {
    return { isValid: false, error: "Account number is required" };
  }

  if (!/^\d{10}$/.test(accountNumber.trim())) {
    return { isValid: false, error: "Account number must be exactly 10 digits" };
  }

  if (!accountName || accountName.trim().length === 0) {
    return { isValid: false, error: "Account name is required" };
  }

  return { isValid: true, error: null };
};

module.exports = {
  NIGERIAN_BANKS,
  getFlutterwaveBankCode,
  getFlutterwaveBankName,
  getNigerianBanks,
  getBanksAsArray,
  validateBankDetails,
};
