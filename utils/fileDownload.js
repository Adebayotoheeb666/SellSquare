require("aws-sdk/lib/maintenance_mode_message").suppress = true;
const AWS = require("aws-sdk");
const fs = require("fs");
const puppeteer = require("puppeteer");
const { receiptTemplate } = require("./pdfTemplate");

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new AWS.S3({
  AWS_SDK_LOAD_CONFIG: 1,
  region: region,
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
});

const createReceipt = async ({
  data,
  business,
  logo,
  businessAddress,
  businessPhone,
  customer,
  orderId,
}) => {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        `--no-sandbox`,
        `--headless`,
        `--disable-gpu`,
        `--disable-dev-shm-usage`,
      ],
    });

    const page = await browser.newPage();

    await page.setContent(
      receiptTemplate({
        data,
        business,
        logo,
        businessAddress,
        businessPhone,
        customer,
        orderId,
      })
    );
    await page.setViewport({
      width: 300,
      height: 600,
    });

    await page.pdf({ path: `${data._id}.pdf` });

    const fileData = fs.readFileSync(`${data._id}.pdf`);
    const params = {
      Bucket: "icon-path-bucket",
      Body: fileData,
      Key: data._id + ".pdf",
      ContentEncoding: "base64",
      contentType: "application/pdf",
    };

    let dataToUser = {};

    // delete file after it is uploaded to s3 bucket
    fs.unlinkSync(`${data._id}.pdf`);

    // Close the browser
    await browser.close();

    return new Promise((resolve, reject) => {
      s3.upload(params, function (err, response) {
        if (err) {
          console.log("Error uploading file:", err);
          reject(err);
        } else {
          dataToUser = response;
          // console.log('Successfully uploaded file:', dataToUser);
          resolve(dataToUser);
        }
      });
    });
  } catch (err) {
    console.error("Error generating PDF:", err);
  } finally {
    // Close the browser
    if (browser !== null) {
      await browser.close();
    }
  }
};

const uploadImageToS3 = async (filePath, fileName) => {
  try {
    const fileData = fs.readFileSync(filePath);

    // Set the S3 upload parameters
    const params = {
      Bucket: bucketName,
      Body: fileData,
      Key: fileName,
      ContentEncoding: "base64",
      ContentType: "image/jpeg", 
    };

    // Upload the image to S3
    return new Promise((resolve, reject) => {
      s3.upload(params, function (err, response) {
        if (err) {
          console.log("Error uploading image:", err);
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  } catch (err) {
    console.error("Error uploading image:", err);
  }
};

module.exports = { createReceipt, uploadImageToS3 };
