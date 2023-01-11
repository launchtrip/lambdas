const AWS = require('aws-sdk');
const jobSettings = require('./jobSettings.json');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');

const ffmpegSync = (video, S3KeyGif, s3) => {
  console.log('S3KeyGif', S3KeyGif);
  return new Promise((resolve, reject) => {
    ffmpeg(video)
      .setDuration(1)
      .withAspect('4:3')
      .addOutputOptions('-fs', '1500k')
      .fps(10)
      .output(S3KeyGif)
      .on('end', async function (err) {
        if (!err) {
          console.log('CONVERTED');
          const S3KeyGif = `${Key}/Gif/${Key}.gif`;
          const gif = await fs.createReadStream(S3KeyGif);
          const gifParams = {
            Bucket: 'duploservices-qa1-output-files-776536559867',
            Key: `${S3KeyGif}`,
            Body: gif,
          };
          const gifUpload = await s3.upload(gifParams).promise();
          console.log('gifUpload', gifUpload);
          fs.unlinkSync(S3KeyGif, (err) => {
            if (err) {
              console.log('err', err);
            }
          });
        }
      })
      .on('error', function (err) {
        console.log(err);
      })
      .run();
  });
};

exports.handler = async (event) => {
  const sourceS3Bucket = event.Records[0].s3.bucket.name;
  const sourceS3Key = event.Records[0].s3.object.key;
  const assetID = sourceS3Key;
  const sourceS3 = `s3://${sourceS3Bucket}/${sourceS3Key}`;
  const sourceS3Basename = sourceS3Key.split('.')[0];
  const destinationS3 = `s3://${process.env.DestinationBucket}`;
  const mediaConvertRole = process.env.MediaConvertRole;
  const region = process.env.AWS_DEFAULT_REGION;
  let statusCode = 200;
  const body = {};

  // Use MediaConvert SDK UserMetadata to tag jobs with the assetID
  // Events from MediaConvert will have the assetID in UserMedata
  const jobMetadata = { assetID };
  try {
    // Job settings are in the lambda zip file in the current working directory
    // const jobSettings = JSON.parse(fs.readFileSync('jobSettings.json', 'utf8'));
    console.log(jobSettings);
    // get the account-specific mediaconvert endpoint for this region
    const mc_client = new AWS.MediaConvert({ region });
    console.log('mc_client', mc_client);
    const endpoints = await mc_client.describeEndpoints().promise();
    console.log('endpoints', endpoints);
    // add the account-specific endpoint to the client session
    const client = new AWS.MediaConvert({
      region,
      endpoint: endpoints.Endpoints[0].Url,
      sslEnabled: false,
    });
    console.log('client', client);
    // Update the job settings with the source video from the S3 event and destination
    // paths for converted videos
    jobSettings.Inputs[0].FileInput = sourceS3;

    console.log(
      'jobSettings.Settings.Inputs[0].FileInput',
      jobSettings.Inputs[0].FileInput
    );
    const S3KeyWatermark = `${sourceS3Basename}/MP4/${sourceS3Basename}`;
    jobSettings.OutputGroups[0].OutputGroupSettings.FileGroupSettings.Destination = `${destinationS3}/${S3KeyWatermark}`;
    console.log('S3KeyWatermark', S3KeyWatermark);

    const S3KeyThumbnails = `${sourceS3Basename}/Thumbnails/${sourceS3Basename}`;
    jobSettings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = `${destinationS3}/${S3KeyThumbnails}`;
    console.log('S3KeyThumbnails', S3KeyThumbnails);

    console.log('jobSettings:', Date.now());
    console.log(JSON.stringify(jobSettings), Date.now());

    // Convert the video using AWS Elemental MediaConvert
    const job = await client
      .createJob({
        Role: mediaConvertRole,
        UserMetadata: jobMetadata,
        Settings: jobSettings,
      })
      .promise();
    console.log('job', JSON.stringify(job), Date.now());

    // Create Gif from video
    const S3KeyGif = `${sourceS3Basename}/Gif/${sourceS3Basename}.gif`;
    console.log('S3KeyGif', S3KeyGif);
    const s3 = new AWS.S3();
    const params = {
      Bucket: sourceS3Bucket,
      Key: sourceS3Key,
    };
    console.log('params', params, Date.now());
    const s3Stream = await s3.getObject(params).createReadStream();
    console.log('s3Stream', s3Stream, Date.now());
    await ffmpegSync(s3Stream, S3KeyGif, s3);
  } catch (e) {
    console.log(`Exception: ${e}`);
    statusCode = 500;
    throw e;
  } finally {
    return {
      statusCode,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};
