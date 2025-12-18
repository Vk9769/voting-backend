import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { getVoterProfile } from "../controllers/voterController.js";

const router = express.Router();

router.get(
  "/profile",
  authenticate,
  allowRoles("VOTER"),
  getVoterProfile
);

export default router;
