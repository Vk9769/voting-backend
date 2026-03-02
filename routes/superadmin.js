import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { uploadSuperAdminCreatePhoto } from "../middleware/uploadProfilePhoto.js";

import {
  createSuperAdmin,
  listSuperAdmins,
  deleteSuperAdmin,
  getSuperAdminCounts,
  getSuperAdminById,
  updateSuperAdmin
} from "../controllers/superAdminController.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  uploadSuperAdminCreatePhoto.single("profilePhoto"),
  createSuperAdmin
);

router.get(
  "/list",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  listSuperAdmins
);

router.delete(
  "/delete/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  deleteSuperAdmin
);

router.get(
  "/counts",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getSuperAdminCounts
);

router.get(
  "/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getSuperAdminById
);

router.put(
  "/update/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  updateSuperAdmin
);

router.put(
  "/update-full/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  uploadSuperAdminCreatePhoto.single("profilePhoto"),
  updateSuperAdminFull
);

export default router;