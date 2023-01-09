const AWS = require('aws-sdk');
const { randomUUID } = require('crypto');
const fs = require('fs');
const jobSettings = require('./jobSettings.json');

exports.handler = async (event) => {
  const sourceS3Bucket = event.Records[0].s3.bucket.name;
  const sourceS3Key = event.Records[0].s3.object.key;
  const sourceS3 = `s3://${sourceS3Bucket}/${sourceS3Key}`;
  const sourceS3Basename = sourceS3Key.split('.')[0];
  const destinationS3 = `s3://${process.env.DestinationBucket}`;
  const mediaConvertRole = process.env.MediaConvertRole;
  const region = process.env.AWS_DEFAULT_REGION;
  let statusCode = 200;
  const body = {};

  // Use MediaConvert SDK UserMetadata to tag jobs with the sourceS3Basename
  // Events from MediaConvert will have the sourceS3Basename in UserMedata
  const jobMetadata = { sourceS3Basename };
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

    console.log('jobSettings:');
    console.log(JSON.stringify(jobSettings));

    // Convert the video using AWS Elemental MediaConvert
    const job = await client
      .createJob({
        Role: mediaConvertRole,
        UserMetadata: jobMetadata,
        Settings: jobSettings,
      })
      .promise();
    console.log('job', JSON.stringify(job));
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
