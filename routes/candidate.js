import express from "express";
import { createCandidate } from "../controllers/candidateController.js";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

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
  createCandidate
);

export default router;
