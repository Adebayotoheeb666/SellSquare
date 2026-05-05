export const SUPER_ADMIN_EMAILS = [
  "yemijoshua81@gmail.com",
  "yemijoshua80@gmail.com",
];

export const isSuperAdminEmail = (email) => {
  const normalizedEmail = String(email || "").toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(normalizedEmail);
};
