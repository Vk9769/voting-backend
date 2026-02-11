import express from "express";
import { createCandidate } from "../controllers/candidateController.js";
import { authMiddleware } from "../middleware/auth.js";
import { roleCheck } from "../middleware/roleCheck.js";

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
  authMiddleware,
  roleCheck([
    "MASTER_ADMIN",
    "SUPER_ADMIN",
    "ADMIN"
  ]),
  createCandidate
);

export default router;
