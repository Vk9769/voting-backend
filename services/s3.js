import AWS from "aws-sdk";

AWS.config.update({
  region: process.env.AWS_REGION
});

export const s3 = new AWS.S3();

export const getSignedImageUrl = (key) => {
  return s3.getSignedUrl("getObject", {
    Bucket: "voting-app-profile-photos",
    Key: key,
    Expires: 300 // 5 minutes
  });
};
