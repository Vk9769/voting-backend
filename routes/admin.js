import express from "express";
import { adminHome } from "../controllers/adminController.js";
const router = express.Router();

router.get("/", adminHome);

export default router;
