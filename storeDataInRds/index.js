const axios = require('axios');

exports.handler = async (event) => {
  console.log(event);
  for (let i = 0; i < event.Records.length; i++) {
    const s3Object = event.Records[i];
    console.log('s3Object', s3Object);
    const sourceS3FileName = s3Object.s3.object.key;
    const sourceS3BucketName = s3Object.s3.bucket.name;
    const folderName = sourceS3FileName.split('/')[0];

    const fileExtension = sourceS3FileName.split('.')[1];

    const folderTypeName = sourceS3FileName.split('/')[1];
    console.log({
      sourceS3FileName,
      sourceS3BucketName,
      folderName,
      fileExtension,
      folderTypeName,
    });

    if (folderTypeName !== 'OverWriteThumbnail') {
      const attributeName =
        fileExtension === 'mp4'
          ? 'videoUrl'
          : fileExtension === 'gif'
          ? 'animatedGifUrl'
          : 'thumbnailUrl';

      const fileUrl = `https://${sourceS3BucketName}.s3.${s3Object.awsRegion}.amazonaws.com/${sourceS3FileName}`;
      try {
        const { data } = await axios.patch(
          `https://qa-app-be.launchtrip.com/events/v2/public/videos/media/${folderName}`,
          {
            [attributeName]: fileUrl,
          }
        );
        console.log('video updated successfully', data);
      } catch (err) {
        console.log('Error in update video information', err);
      }
    }
  }
};
