import express from "express";
import {
  allocateBoothsToElection,
  getElectionBoothsByElection,
  getElectionBoothsByWard,
  removeBoothFromElection
} from "../controllers/electionBoothController.js";

import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

/* =========================
   ELECTION BOOTH ALLOCATION
========================= */

// Allocate booths (bulk)
router.post(
  "/allocate",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  allocateBoothsToElection
);

// Get allocated booths for election
router.get(
  "/",
  authenticate,
  getElectionBoothsByElection
);

// Get allocated booths by ward
router.get(
  "/by-ward",
  authenticate,
  getElectionBoothsByWard
);

// Remove booth from election
router.delete(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  removeBoothFromElection
);

export default router;
