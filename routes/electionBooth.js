import express from "express";
import {
  createElectionBooth,
  getElectionBoothsByElection,
  getElectionBoothsByWard,
  updateElectionBooth,
  deleteElectionBooth
} from "../controllers/electionBoothController.js";

import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

/* =========================
   ELECTION BOOTHS (Municipal)
========================= */

// Create election booth
router.post(
  "/",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  createElectionBooth
);

// Get booths by election
router.get(
  "/",
  authenticate,
  getElectionBoothsByElection
);

// Get booths by ward
router.get(
  "/by-ward",
  authenticate,
  getElectionBoothsByWard
);

// Update election booth
router.put(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  updateElectionBooth
);

// Delete election booth
router.delete(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  deleteElectionBooth
);

export default router;
