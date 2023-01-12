const AWS = require('aws-sdk');
const jobSettings = require('./jobSettings.json');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
// const fs = require('fs');
const mockEvent = require('./event_example.json');

// create media convert job
const mediaConvertJob = async (record) => {
  try {
    const sourceS3Bucket = record.s3.bucket.name;
    const sourceS3Key = record.s3.object.key;
    const sourceS3 = `s3://${sourceS3Bucket}/${sourceS3Key}`;
    const destinationS3 = `s3://${process.env.DestinationBucket}`;
    const mediaConvertRole = process.env.MediaConvertRole;
    const region = process.env.AWS_DEFAULT_REGION;

    // media convert client
    const mc_client = new AWS.MediaConvert({ region });
    const endpoints = await mc_client.describeEndpoints().promise();
    const client = new AWS.MediaConvert({
      region,
      endpoint: endpoints.Endpoints[0].Url,
      sslEnabled: false,
    });

    // set job setting
    jobSettings.Inputs[0].FileInput = sourceS3;

    const S3KeyWatermark = `${sourceS3Key}/MP4/${sourceS3Key}`;
    jobSettings.OutputGroups[0].OutputGroupSettings.FileGroupSettings.Destination = `${destinationS3}/${S3KeyWatermark}`;

    const S3KeyThumbnails = `${sourceS3Key}/Thumbnails/${sourceS3Key}`;
    jobSettings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = `${destinationS3}/${S3KeyThumbnails}`;

    console.log('jobSettings', JSON.stringify(jobSettings), Date.now());

    // Convert the video using AWS Elemental MediaConvert
    const job = await client
      .createJob({
        Role: mediaConvertRole,
        UserMetadata: { assetID: sourceS3Key },
        Settings: jobSettings,
      })
      .promise();
    console.log('job  created', JSON.stringify(job), Date.now());
  } catch (err) {
    console.log('Error in create mediaconvert job', err);
  }
};

const ffmpegJob = async (record) => {
  try {
    const s3 = new AWS.S3();
    const sourceS3Bucket = record.s3.bucket.name;
    const sourceS3Key = record.s3.object.key;
    const S3KeyGif = `${sourceS3Key}/Gif/${sourceS3Key}.gif`;
    console.log('start get file');
    const video = await s3.getObject({ Bucket: sourceS3Bucket, Key: sourceS3Key }).createReadStream();
    console.log(video);
    console.log('end get file');

    // Use ffmpeg to convert the video to a GIF
    const gif = await new Promise((resolve, reject) => {
      ffmpeg(video)
        .setDuration(1)
        .withAspect('4:3')
        .addOutputOptions('-fs', '1500k')
        .fps(10)
        // .outputOptions('-pix_fmt', 'rgb24')
        // .outputOptions('-r', '10')
        // .outputOptions('-f', 'gif')
        // .output('test.gif')
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    console.log(gif);

    // Upload the GIF to S3
    await s3
      .putObject({
        Body: gif,
        Bucket: sourceS3Bucket,
        Key: S3KeyGif,
        ContentType: 'image/gif',
      })
      .promise();
  } catch (err) {
    console.log('Error in generate Gif File', err);
  }
};

const handler = async (event) => {
  for (let i = 0; i < event.Records.length; i++) {
    await Promise.all([mediaConvertJob(event.Records[i]), ffmpegJob(event.Records[i])]);
  }
};

handler(mockEvent);
