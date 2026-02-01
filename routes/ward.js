import express from "express";
import {
  createWard,
  getWardsByElection,
  getWardById,
  updateWard,
  deleteWard
} from "../controllers/wardController.js";

import auth from "../middleware/auth.js";
import roleCheck from "../middleware/roleCheck.js";

const router = express.Router();

// 🔐 Only MASTER_ADMIN / ADMIN should manage wards
router.post("/", auth, roleCheck(["MASTER_ADMIN", "ADMIN"]), createWard);
router.get("/", auth, getWardsByElection);
router.get("/:id", auth, getWardById);
router.put("/:id", auth, roleCheck(["MASTER_ADMIN", "ADMIN"]), updateWard);
router.delete("/:id", auth, roleCheck(["MASTER_ADMIN", "ADMIN"]), deleteWard);

export default router;
