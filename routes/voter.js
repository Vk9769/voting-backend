import express from "express";
import { getVoterProfile } from "../controllers/voterController.js";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// 🔐 Voter profile (logged-in voter only)
router.get(
  "/profile",
  authenticate,
  allowRoles("VOTER"),
  getVoterProfile
);

export default router;
