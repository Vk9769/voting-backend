import express from "express";

import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { uploadAdminCreatePhoto } from "../middleware/uploadProfilePhoto.js";

import {
  createAdmin,
  listAdmins,
  deleteAdmin,
  getAdminCounts,
  getAdminById,
  updateAdmin,
  updateAdminFull
} from "../controllers/adminController.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  uploadAdminCreatePhoto.single("profilePhoto"),
  createAdmin
);

router.get(
  "/list",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  listAdmins
);

router.delete(
  "/delete/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  deleteAdmin
);

router.get(
  "/counts",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getAdminCounts
);

router.get(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getAdminById
);

router.put(
  "/update/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  updateAdmin
);

router.put(
  "/update-full/:id",
  authenticate,
  uploadAdminCreatePhoto.single("profilePhoto"),
  updateAdminFull
);

export default router;