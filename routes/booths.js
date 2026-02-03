import express from "express";
import { getBoothsForElection } from "../controllers/boothController.js";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

/* =========================
   BOOTHS (MASTER DATA)
========================= */

/**
 * Get available booths for an election
 * query:
 *  ?election_id=
 *  &ac_name_no= (optional)
 *  &ward_id=    (optional)
 */
router.get(
  "/for-election",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  getBoothsForElection
);

router.get(
  "/acs-for-election",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  getACsForElection
);


export default router;
