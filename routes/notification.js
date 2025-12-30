import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import {
  getNotifications,
  markAsRead,
  deleteNotifications
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", authenticate, allowRoles("VOTER"), getNotifications);

router.patch("/:id/read", authenticate, allowRoles("VOTER"), markAsRead);

router.delete("/", authenticate, allowRoles("VOTER"), deleteNotifications);

router.get(
  "/unread-count",
  authenticate,
  getUnreadCount
);


export default router;
