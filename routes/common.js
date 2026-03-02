import express from "express";
import {
  getElectionType,
  searchUserByVoterId,
   getElectionStates
} from "../controllers/commonController.js";

const router = express.Router();

/* =============================
   SHARED / REUSABLE APIs
============================= */

router.get("/election-type", getElectionType);
router.get("/search-user", searchUserByVoterId);
router.get("/election-states", getElectionStates);
export default router;
