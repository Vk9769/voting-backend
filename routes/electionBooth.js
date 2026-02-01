import express from "express";
import {
  createElectionBooth,
  getElectionBoothsByElection,
  getElectionBoothsByWard,
  updateElectionBooth,
  deleteElectionBooth
} from "../controllers/electionBoothController.js";

import auth from "../middleware/auth.js";
import roleCheck from "../middleware/roleCheck.js";

const router = express.Router();

// 🔐 Only ADMIN / MASTER_ADMIN manage booths
router.post(
  "/",
  auth,
  roleCheck(["MASTER_ADMIN", "ADMIN"]),
  createElectionBooth
);

router.get("/", auth, getElectionBoothsByElection);
router.get("/by-ward", auth, getElectionBoothsByWard);

router.put(
  "/:id",
  auth,
  roleCheck(["MASTER_ADMIN", "ADMIN"]),
  updateElectionBooth
);

router.delete(
  "/:id",
  auth,
  roleCheck(["MASTER_ADMIN", "ADMIN"]),
  deleteElectionBooth
);

export default router;
