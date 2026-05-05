require("dotenv").config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);


const sendSMS = (phone, message) => {
    // Send the text message. 
    try {
        client.messages
            .create({
                body: message,
                from: '+12176456009',
                to: phone
            })
            .then(message => console.log("SMS successfully sent", message.sid))
            .done();
    } catch (error) {
        console.log("There is an error", error);
    }
};

module.exports = { sendSMS };
