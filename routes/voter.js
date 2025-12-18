import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

const router = express.Router();

router.get(
  "/home",
  authenticate,
  allowRoles("voter"),
  (req, res) => {
    res.json({ message: "Voter dashboard", user: req.user });
  }
);

export default router;
