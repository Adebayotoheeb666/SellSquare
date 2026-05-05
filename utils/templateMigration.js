/**
 * Template Migration Utility
 * Helps initialize the template system with hardcoded defaults
 * Can be run once or as part of onboarding
 */

const Template = require("../models/templateModel");

const HARDCODED_TEMPLATES = {
  "password-reset": {
    type: "email",
    category: "confirmation",
    subject: "Reset Your Password",
    body: `Hello {{email}},

You recently requested to reset your password for your SellSquare account. Click the button below to proceed. This link will expire in {{expiresIn}} minutes.

[Reset Password]({{resetUrl}})

If you didn't request this, you can safely ignore this email.

Regards,
SellSquare Team`,
  },

  "receipt": {
    type: "email",
    category: "transactional",
    subject: "Your Purchase Receipt",
    body: `Hello {{customerName}},

Thank you for your purchase at {{businessName}}! We have attached your receipt.

Order Total: {{orderTotal}}
Order Date: {{orderDate}}

Regards,
{{businessName}}`,
  },

  "contact-form-notification": {
    type: "email",
    category: "operational",
    subject: "New Contact Form Submission: {{subject}}",
    body: `New contact form message received:

From: {{senderName}}
Email: {{senderEmail}}
Subject: {{subject}}

Message:
{{messageContent}}

---
Reply to {{senderEmail}} or use the reply-to feature in your email client.`,
  },

  "welcome-customer": {
    type: "email",
    category: "welcome",
    subject: "Welcome to {{businessName}}!",
    body: `Hello {{customerName}},

Welcome to {{businessName}}! We're excited to have you as a customer.

Here are a few things you can do:
- Browse our {{productCategory}} collection
- Create a wishlist of items you love
- Use code WELCOME10 for 10% off your first order

If you have any questions, feel free to reach out to our support team.

Best regards,
{{businessName}} Team`,
  },

  "order-confirmation": {
    type: "email",
    category: "transactional",
    subject: "Order Confirmed - {{orderNumber}}",
    body: `Hello {{customerName}},

Your order has been confirmed!

Order Number: {{orderNumber}}
Order Date: {{orderDate}}
Total: {{orderTotal}}

Items:
{{orderItems}}

You will receive a shipping notification with tracking information soon.

Thank you for your purchase!

Regards,
{{businessName}}`,
  },

  "abandoned-cart-reminder": {
    type: "email",
    category: "abandoned-cart",
    subject: "You left something behind...",
    body: `Hi {{customerName}},

You have {{itemCount}} item(s) waiting in your cart!

Items Left Behind:
{{cartItems}}

Total Value: {{cartTotal}}

Complete your purchase now before items sell out!
[Recover Cart]({{cartRecoveryUrl}})

Use code COMEBACK15 for 15% off to complete your order.

Best regards,
{{businessName}} Team`,
  },

  "application-received": {
    type: "email",
    category: "confirmation",
    subject: "Application Received - {{position}}",
    body: `Hi {{applicantName}},

Thank you for applying for the {{position}} role at {{businessName}}!

We've received your application and our team is excited to review it.

What happens next?
- Application Review: Our team will carefully review your CV and portfolio within 5-7 business days
- Initial Screening: If your profile matches, we'll reach out to schedule a call
- Assessment: Selected candidates will receive a creative brief
- Final Interview: Top candidates will meet with our team

If you don't hear from us within 2 weeks, we've decided to move forward with other candidates for this round.

Best regards,
The {{businessName}} Careers Team`,
  },

  "order-shipped": {
    type: "email",
    category: "transactional",
    subject: "Your Order is On Its Way!",
    body: `Hello {{customerName}},

Great news! Your order {{orderNumber}} has shipped!

Tracking Number: {{trackingNumber}}
Carrier: {{shippingCarrier}}
Expected Delivery: {{estimatedDelivery}}

[Track Your Package]({{trackingUrl}})

If you have any questions about your order, please don't hesitate to contact us.

Thank you for shopping with {{businessName}}!

Regards,
{{businessName}} Team`,
  },

  "payment-failed": {
    type: "email",
    category: "operational",
    subject: "Payment Failed - Action Required",
    body: `Hello {{customerName}},

Unfortunately, we weren't able to process your payment for order {{orderNumber}}.

This could be due to:
- Insufficient funds
- Card expiration
- Incorrect card details
- Bank fraud protection

Please update your payment method to complete your order:
[Update Payment]({{paymentUpdateUrl}})

If you need help, our support team is here to assist you.

Best regards,
{{businessName}} Team`,
  },

  "newsletter-subscription": {
    type: "email",
    category: "marketing",
    subject: "Welcome to Our Newsletter!",
    body: `Hello {{subscriberName}},

Thank you for subscribing to our newsletter!

You'll now receive:
- Exclusive product updates
- Special promotions and discounts
- Industry tips and insights
- Early access to new launches

We're excited to stay connected with you!

Best regards,
{{businessName}} Team`,
  },
};

/**
 * Initialize default templates for a business
 * Call this when a business is first created or during migration
 */
async function initializeDefaultTemplates(businessId, createdById = null) {
  try {
    const results = {
      created: [],
      skipped: [],
      errors: [],
    };

    for (const [key, templateData] of Object.entries(HARDCODED_TEMPLATES)) {
      try {
        // Check if template already exists
        const existing = await Template.findOne({
          business: businessId,
          name: key,
        });

        if (existing) {
          results.skipped.push(key);
          continue;
        }

        // Extract variables from body and subject
        const variableRegex = /\{\{(\w+(?:\.\w+)*)\}\}|\$\{(\w+(?:\.\w+)*)\}/g;
        const variables = [];
        let match;

        const textToSearch = `${templateData.subject || ""} ${templateData.body}`;
        while ((match = variableRegex.exec(textToSearch)) !== null) {
          const varName = match[1] || match[2];
          if (!variables.includes(varName)) {
            variables.push(varName);
          }
        }

        // Create template
        const newTemplate = await Template.create({
          business: businessId,
          name: key,
          description: `Auto-generated template: ${key}`,
          ...templateData,
          variables,
          isActive: true,
          createdBy: createdById,
        });

        results.created.push({
          name: key,
          id: newTemplate._id,
        });
      } catch (error) {
        results.errors.push({
          template: key,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    throw new Error(`Template initialization failed: ${error.message}`);
  }
}

/**
 * Get default template by key
 */
function getDefaultTemplate(key) {
  return HARDCODED_TEMPLATES[key] || null;
}

/**
 * List all available default templates
 */
function listDefaultTemplates() {
  return Object.keys(HARDCODED_TEMPLATES).map((key) => ({
    key,
    name: key,
    ...HARDCODED_TEMPLATES[key],
  }));
}

module.exports = {
  initializeDefaultTemplates,
  getDefaultTemplate,
  listDefaultTemplates,
  HARDCODED_TEMPLATES,
};
