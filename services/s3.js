import AWS from "aws-sdk";

AWS.config.update({
  region: process.env.AWS_REGION
});

export const s3 = new AWS.S3();

/* =========================
   SIGNED URL (V2)
========================= */
export const getSignedImageUrl = async (key) => {
  if (!key || typeof key !== "string" || key.trim() === "") {
    return null;
  }

  return s3.getSignedUrlPromise("getObject", {
    Bucket: "voting-app-profile-photos",
    Key: key,
    Expires: 300
  });
};
