import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import {
  getVoterProfile,
  updateVoterProfile,
  uploadVoterPhoto
} from "../controllers/voterController.js";
import { uploadProfilePhoto } from "../middleware/uploadProfilePhoto.js";

const router = express.Router();

router.get7
  "/profile",
  authenticate,
  allowRoles("VOTER"),
  getVoterProfile
);

router.put(
  "/profile",
  authenticate,
  allowRoles("VOTER"),
  updateVoterProfile
);

router.post(
  "/profile/photo",
  authenticate,
  allowRoles("VOTER"),
  uploadProfilePhoto.single("photo"),
  uploadVoterPhoto
);

export default router;
