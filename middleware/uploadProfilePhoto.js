import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../services/s3.js";

const BUCKET = "voting-app-profile-photos";

/* =========================
   ROLE → FOLDER MAP
========================= */
const ROLE_FOLDER_MAP = {
  VOTER: "voter",
  AGENT: "agent",
  BLO: "blo",
  SUPER_AGENT: "super_agent",
  MASTER_AGENT: "master_agent",
  OBSERVER: "observer",
  CANDIDATE: "candidate",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  MASTER_ADMIN: "master_admin",
};

/* =========================
   UNIVERSAL PROFILE UPLOADER
========================= */
export const uploadProfilePhoto = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: (req, file, cb) => {
      try {
        const userId = req.user.userId;
        const role = req.user.role;

        // 🔒 Safety fallback
        const folder =
          ROLE_FOLDER_MAP[role] || "unknown_role";

        const ext = file.originalname.split(".").pop().toLowerCase();

        cb(
          null,
          `profile-photos/${folder}/${userId}.${ext}`
        );
      } catch (err) {
        cb(err);
      }
    },
  }),

  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
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
  },
});

export const uploadAgentCreatePhoto = multer({
  storage: multerS3({
    s3,
    bucket: "voting-app-profile-photos",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `profile-photos/agent/temp-${Date.now()}.${ext}`);
    },
  }),
});