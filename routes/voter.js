import express from "express";
import { getVoter } from "../controllers/voterController.js";
const router = express.Router();

router.get("/:id", getVoter);

export default router;
