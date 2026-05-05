const client = require("@sendgrid/client");
client.setApiKey(process.env.SENDGRID_API_KEY);

async function getSendersList() {
  const request = {
    url: `/v3/marketing/senders`,
    method: "GET",
  };

  try {
    const [response, body] = await client.request(request);
    return response.body;
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = getSendersList;