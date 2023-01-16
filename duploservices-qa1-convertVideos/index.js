const AWS = require('aws-sdk');
const jobSettings = require('./jobSettings.json');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');
import { spawn } from 'node:child_process';
import gifsicle from 'gifsicle';

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

const compressGif = async (gif) => {
  const compressedGifAndWriteTheFile = await new Promise((resolve, reject) => {
    const child = spawn(gifsicle, [
      '-O3',
      '-lossy=80',
      gif,
      '-o',
      '/tmp/compressedGif.gif',
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.error('stderr', stderr);
        throw new Error(stderr);
      }
      resolve(stdout);
    });
  });
  return compressedGifAndWriteTheFile;
};

const ffmpegJob = async (record) => {
  try {
    const outputFile = fs.createWriteStream('/tmp/gif.gif');
    const s3 = new AWS.S3();
    const sourceS3Bucket = record.s3.bucket.name;
    const sourceS3Key = record.s3.object.key;
    const S3KeyGif = `${sourceS3Key}/Gif/${sourceS3Key}.gif`;
    console.log('start get file');
    const video = await s3
      .getObject({ Bucket: sourceS3Bucket, Key: sourceS3Key })
      .createReadStream();
    console.log('end get file', video);

    // Use ffmpeg to convert the video to a GIF
    await new Promise((resolve, reject) => {
      console.log('outputFile', outputFile);
      ffmpeg(video)
        .setDuration(1)
        .withAspect('16:9')
        .addOutputOptions(
          '-filter:v',
          '[0:v] fps=15,scale=540:-1:flags=lanczos,split [a][b];[a] palettegen [p];[b][p] paletteuse'
        )
        .format('gif')
        .fps(10)
        .output(outputFile)
        .on('end', async function (err) {
          if (err) {
            console.error(err);
            throw new Error(err);
          }
          console.log('Video converted to GIF successfully!');
          resolve('Video converted to GIF successfully!');
        })
        .on('error', function (err) {
          console.error(err);
          reject(err);
        })
        .run();
    });

    if (fs.existsSync('/tmp/gif.gif')) {
      console.log('File exists');
      // use gifsicle to compress the gif
      await compressGif('/tmp/gif.gif');
      const gifFile = fs.createReadStream('/tmp/compressedGif.gif');
      await s3
        .upload({
          Body: gifFile,
          Bucket: process.env.DestinationBucket,
          Key: S3KeyGif,
          ContentType: 'image/gif',
          // ACL: 'public-read'
        })
        .promise();
    } else {
      console.log('file not exist');
    }
    // Upload the GIF to S3
  } catch (err) {
    console.log('Error in generate Gif File', err);
  }
};

exports.handler = async (event) => {
  for (let i = 0; i < event.Records.length; i++) {
    await Promise.all([
      mediaConvertJob(event.Records[i]),
      ffmpegJob(event.Records[i]),
    ]);
  }
};
