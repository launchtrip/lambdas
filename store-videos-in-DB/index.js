const AWS = require('aws-sdk');
const https = require('https');

exports.handler = async (event) => {
  const sourceS3FileName = event.Records[0].s3.object.key;
  const sourceS3Basename = sourceS3FileName.split('.')[0];

  console.log('sourceS3FileName', sourceS3FileName);
  console.log('sourceS3Basename', sourceS3Basename);

  const s3 = new AWS.S3({ region: 'us-west-2' });

  const videoUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.SourceBucket,
    Key: `${sourceS3Basename}/MP4/${sourceS3Basename}.mp4`,
    Expires: 60 * 60 * 24 * 365,
  });

  console.log('videoUrl', videoUrl);

  const thumbnailUrl = await s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.SourceBucket,
    Key: `${sourceS3FileName}/Thumbnails/${sourceS3FileName}0000000.jpg`,
    Expires: 60 * 60 * 24 * 365,
  });

  console.log('thumbnailUrl', thumbnailUrl);

  const req = https.request({
    hostname: 'qa-app-be.launchtrip.com',
    path: `/events/v2/media/${sourceS3FileName}`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  req.on('error', (e) => {
    console.error(e);
  });

  const body = JSON.stringify({
    videoUrl,
    thumbnailUrl,
  });

  console.log('body', body);

  req.write(body);
  req.end();
};
