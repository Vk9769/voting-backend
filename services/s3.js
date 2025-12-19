import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION
});

export const getSignedImageUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: "voting-app-profile-photos",
    Key: key
  });

  return await getSignedUrl(s3, command, {
    expiresIn: 300 // 5 minutes
  });
};
