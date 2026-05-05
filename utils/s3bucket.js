const fs = require('fs');
const AWS = require('aws-sdk');

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// console.log(accessKeyId);

const s3 = new AWS.S3({
  AWS_SDK_LOAD_CONFIG: 1,
  region: region,
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
})


// Uploads to s3 
async function uploadFile(file) {

  console.log(file)
  const fileStream = fs.createReadStream(file)

  const params = {
    Bucket: bucketName,
    Body: fileStream,
    Key: file,
    contentType: "application/pdf"
  }

  const res = await new Promise((resolve, reject) => {
    s3.upload(params, (error, data) => error == null ? resolve(data) : reject(error))
  })

  return { fileUrl: res.Location }
}

exports.uploadFile = uploadFile




// Downloads from s3 
function getFileStream(key) {
  const downloadParams = {
    Key: key,
    Bucket: bucketName
  }

  return s3.getObject(downloadParams).createReadStream();
}

exports.getFileStream = getFileStream


// Downloads from s3 
function sendToPrinter(key) {
  return new Promise((resolve, reject) => {
    const downloadParams = {
      Key: key,
      Bucket: bucketName
    }

    s3.getObject(downloadParams, (err, data) => {
      if (err) {
        console.log(err);
        reject(err);
        return;
      }
    
      resolve(data.Body);
    });
  });
}

exports.sendToPrinter = sendToPrinter