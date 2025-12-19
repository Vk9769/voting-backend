import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../services/s3.js";

const BUCKET = "voting-app-profile-photos";

export const uploadProfilePhoto = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    acl: "private",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const userId = req.user.userId;
      const ext = file.originalname.split(".").pop();

      cb(null, `profile-photos/voter/${userId}.${ext}`);
    }
  }),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  }
});
