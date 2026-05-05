const client = require("@sendgrid/client");
client.setApiKey(process.env.SENDGRID_API_KEY);

async function authenticateSender(business) {

  const data = {
    nickname: business.businessName, //business.businessName,
    from: {
      email: business.businessEmail,
      name: business.businessName, //business.businessName,
    },
    reply_to: {
      email: business.businessEmail,
    },
    address: business.businessAddress,
    city: "Akure",
    country: business.country,
  };

  const request = {
    url: `/v3/marketing/senders`,
    method: "POST",
    body: data,
  };

  try {
    const [response, body] = await client.request(request);
    return response;
  } catch (error) {
    console.error(error);
    return null;
  }

  // client
  //   .request(request)
  //   .then(([response, body]) => {
  //     // console.log(response.statusCode);
  //     // console.log(response.body);
  //     return response;
  //   })
  //   .catch((error) => {
  //     console.error(error);
  //     return error;
  //   });
}

module.exports = authenticateSender;