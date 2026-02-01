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
   (Uses existing booths)
========================= */

/**
 * Allocate multiple booths to an election
 * body: { election_id, booth_ids: [] }
 */
router.post(
  "/allocate",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  allocateBoothsToElection
);

/**
 * Get all allocated booths for an election
 * query: ?election_id=
 */
router.get(
  "/",
  authenticate,
  getElectionBoothsByElection
);

/**
 * Get allocated booths by ward
 * query: ?election_id=&ward_id=
 */
router.get(
  "/by-ward",
  authenticate,
  getElectionBoothsByWard
);

/**
 * Remove booth from election (un-allocate)
 * param: election_booth_id
 */
router.delete(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  removeBoothFromElection
);

export default router;
