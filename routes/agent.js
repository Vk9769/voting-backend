import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import {
  uploadProfilePhoto,
  uploadAgentCreatePhoto
} from "../middleware/uploadProfilePhoto.js";

import {
  createAgent,
  getAgentProfile,
  updateAgentProfile,
  uploadAgentPhoto,
  getAgentVoters,
  markVoter,
  listAgents,
  getAgentById,
  getAgentCounts,
  updateAgent,
  updateAgentFull,
  deleteAgent
} from "../controllers/agentController.js";

const router = express.Router();

/* =========================
   CREATE AGENT (ADMIN SIDE)
========================= */
router.post(
  "/",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  uploadAgentCreatePhoto.single("profilePhoto"),
  createAgent
);

/* =========================
   DELETE AGENT (ADMIN)
========================= */
router.delete(
  "/delete/:id",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  deleteAgent
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

router.get(
  "/voters",
  authenticate,
  allowRoles("AGENT"),
  getAgentVoters
);

router.post(
  "/voters/mark",
  authenticate,
  allowRoles("AGENT"),
  markVoter
);

/* =========================
   ADMIN LIST + COUNTS
========================= */
router.get(
  "/list",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  listAgents
);

router.get(
  "/counts/:electionId",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  getAgentCounts
);

router.put(
  "/update/:id",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  updateAgent
);

/* =========================
   FULL UPDATE (ADMIN)
========================= */
router.put(
  "/:id",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  uploadAgentCreatePhoto.single("profilePhoto"),
  updateAgentFull
);

router.get(
  "/:id",
  authenticate,
  allowRoles("ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"),
  getAgentById
);

export default router;