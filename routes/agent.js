import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { uploadProfilePhoto } from "../middleware/uploadProfilePhoto.js";

import {
  createAgent,
  getAgentProfile,
  updateAgentProfile,
  uploadAgentPhoto,
} from "../controllers/agentController.js";

const router = express.Router();

/* =========================
   CREATE AGENT (ADMIN SIDE)
========================= */
router.post(
  "/",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  upload.single("profilePhoto"),
  createAgent
);
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
