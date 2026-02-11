import express from "express";
import {
  getElectionType,
  searchUserByVoterId
} from "../controllers/commonController.js";

const router = express.Router();

/* =============================
   SHARED / REUSABLE APIs
============================= */

router.get("/election-type", getElectionType);
router.get("/search-user", searchUserByVoterId);

export default router;
