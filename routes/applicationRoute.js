const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  submitApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  sendBriefToApplicant,
  sendFollowUpEmail,
  getBriefByToken,
  submitBriefResponses,
} = require("../controllers/applicationController");
const protect = require("../middleWare/authMiddleware");
const { applicationEventMiddleware } = require("../events/eventMiddleware");

const router = express.Router();

const uploadsDir = path.join(__dirname, "../uploads/applications");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Temp directory for email attachments
const emailAttachmentsDir = path.join(
  __dirname,
  "../uploads/email-attachments"
);
if (!fs.existsSync(emailAttachmentsDir)) {
  fs.mkdirSync(emailAttachmentsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.fieldname}-${file.originalname}`);
  },
});

// Storage for email attachments (temporary)
const emailAttachmentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, emailAttachmentsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    cb(null, `${timestamp}-${random}-${file.originalname}`);
  },
});

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Allowed MIME types for email attachments (broader support)
const emailAttachmentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Word documents are allowed"));
  }
};

const emailAttachmentFilter = (req, file, cb) => {
  if (emailAttachmentMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "File type not allowed. Supported: PDF, Word, Excel, images, text files"
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadEmailAttachments = multer({
  storage: emailAttachmentStorage,
  fileFilter: emailAttachmentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files
  },
});

// Public routes
router.post(
  "/",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "coverLetter", maxCount: 1 },
  ]),
  applicationEventMiddleware,
  submitApplication
);

// Brief public routes (token based)
router.get("/brief/:token", getBriefByToken);
router.post("/brief/:token/submit", submitBriefResponses);

// Admin routes (should be protected with auth middleware in production)
router.get("/", protect, getApplications);
router.get("/:id", protect, getApplicationById);
router.patch("/:id/status", protect, applicationEventMiddleware, updateApplicationStatus);
router.post("/:id/brief", protect, applicationEventMiddleware, sendBriefToApplicant);
// Email route with optional attachments (multipart/form-data)
router.post(
  "/:id/email",
  protect,
  uploadEmailAttachments.fields([{ name: "attachments", maxCount: 5 }]),
  applicationEventMiddleware,
  sendFollowUpEmail
);

module.exports = router;
