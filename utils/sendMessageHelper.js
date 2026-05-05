require("dotenv").config();
const axios = require("axios");

function sendMessage(data) {
  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`,
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    data: data,
  };

  return axios(config);
}

function getTextMessageInput(recipient, text) {
  return JSON.stringify({
    "messaging_product": "whatsapp",
    "preview_url": false,
    "recipient_type": "individual",
    "to": recipient,
    "type": "text",
    "text": {
        "body": text
    }
  });
}

function getTemplatedMessageInput(recipient, fileUrl) {
  return JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "document",
    document: {
      link: fileUrl,
      filename: "receipt.pdf",
      caption: "Thank you for your purchase! This is your receipt.",
    },
  });
}

module.exports = {
  sendMessage,
  getTextMessageInput,
  getTemplatedMessageInput,
};


