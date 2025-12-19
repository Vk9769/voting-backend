import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../services/s3.js";

const BUCKET = "voting-app-profile-photos";

export const uploadProfilePhoto = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = req.user.userId;
      const ext = file.originalname.split(".").pop();
      cb(null, `profile-photos/voter/${userId}.${ext}`);
    }
  }),
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  }
});
