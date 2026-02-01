import express from "express";
import {
  createWard,
  getWardsByElection,
  getWardById,
  updateWard,
  deleteWard
} from "../controllers/wardController.js";

import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

/* =========================
   WARD MANAGEMENT (Municipal)
========================= */

// Create ward
router.post(
  "/",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  createWard
);

// Get wards by election
router.get(
  "/",
  authenticate,
  getWardsByElection
);

// Get single ward
router.get(
  "/:id",
  authenticate,
  getWardById
);

// Update ward
router.put(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  updateWard
);

// Delete ward
router.delete(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "ADMIN"),
  deleteWard
);

export default router;
