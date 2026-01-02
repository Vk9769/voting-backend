import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { getAllBoothsHierarchy } from "../controllers/masterAdminController.js";

const router = express.Router();

router.get(
  "/booths",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getAllBoothsHierarchy
);

export default router;
