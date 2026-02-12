import express from "express";
import {
  createCandidate,
  listCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  getCandidateCountsByElection
} from "../controllers/candidateController.js";

import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { uploadCandidateAssets } from "../middleware/uploadProfilePhoto.js";

const router = express.Router();

/* =====================================================
   CREATE CANDIDATE
   Accessible by:
   - MASTER_ADMIN
   - SUPER_ADMIN
   - ADMIN
===================================================== */

router.post(
  "/create",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN", "ADMIN"),
   uploadCandidateAssets.fields([
    { name: "candidate_photo", maxCount: 1 },
    { name: "party_symbol", maxCount: 1 },
  ]),
  createCandidate
);

router.get(
  "/list/:election_id",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN", "ADMIN"),
  listCandidates
);

router.get("/details/:id", authenticate, getCandidateById);

router.put(
  "/update/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN", "ADMIN"),
  uploadCandidateAssets.fields([
    { name: "candidate_photo", maxCount: 1 },
    { name: "party_symbol", maxCount: 1 },
  ]),
  updateCandidate
);

router.delete(
  "/delete/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN", "ADMIN"),
  deleteCandidate
);

router.get(
  "/counts/:election_id",
  authenticateToken,
  getCandidateCountsByElection
);

export default router;
