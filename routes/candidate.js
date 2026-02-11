import express from "express";
import { createCandidate } from "../controllers/candidateController.js";
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

export default router;
