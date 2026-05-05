const asyncHandler = require("express-async-handler");
const BusinessRegistration = require("../models/businessRegistration");
const { sendEmail } = require("../utils/sendEmail");

const contactUs = asyncHandler(async (req, res) => {
  const { subject, message, email, name } = req.body;

  //   Validation
  if (!subject || !message || !email || !name) {
    res.status(400);
    throw new Error(
      "Please provide all required fields: name, email, subject, and message"
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const send_to = "sellsquarehub@gmail.com";
  const sent_from = process.env.EMAIL_FROM;
  const reply_to = email;

  try {
    await sendEmail(
      `Contact Form: ${subject}`,
      {
        senderName: name,
        senderEmail: email,
        subject: subject,
        messageContent: message,
      },
      send_to,
      sent_from,
      reply_to,
      { template: "contact" }
    );
    res.status(200).json({
      success: true,
      message: "Thank you for contacting us! We'll get back to you soon.",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500);
    throw new Error("Failed to send message. Please try again later.");
  }
});

module.exports = {
  contactUs,
};
