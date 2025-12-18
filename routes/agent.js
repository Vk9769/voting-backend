import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.get(
  "/home",
  authenticate,
  allowRoles("agent"),
  (req, res) => {
    res.json({ message: "Agent dashboard" });
  }
);


export default router;
