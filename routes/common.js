import express from "express";
import {
  getElectionType,
  searchUserByVoterId,
  getElectionStates,
  getElectionDistricts
} from "../controllers/commonController.js";

const router = express.Router();

/* =============================
   SHARED / REUSABLE APIs
============================= */

router.get("/election-type", getElectionType);
router.get("/search-user", searchUserByVoterId);
router.get("/election-states", getElectionStates);
router.get("/election-districts", getElectionDistricts);

export default router;