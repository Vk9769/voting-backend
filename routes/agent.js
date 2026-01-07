import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { uploadProfilePhoto } from "../middleware/uploadProfilePhoto.js";

import {
  getAgentProfile,
  updateAgentProfile,
  uploadAgentPhoto,
} from "../controllers/agentController.js";

const router = express.Router();

/* =========================
   AGENT PROFILE
========================= */

router.get(
  "/profile",
  authenticate,
  allowRoles("AGENT"),
  getAgentProfile
);

router.put(
  "/profile",
  authenticate,
  allowRoles("AGENT"),
  updateAgentProfile
);

router.post(
  "/profile/photo",
  authenticate,
  allowRoles("AGENT"),
  uploadProfilePhoto.single("photo"),
  uploadAgentPhoto
);

export default router;
