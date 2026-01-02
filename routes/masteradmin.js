import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";
import { getAllBoothsHierarchy,
  getAdminProfile,
  updateAdminProfile,
  uploadAdminPhoto, } from "../controllers/masterAdminController.js";
import { uploadProfilePhoto } from "../middleware/uploadProfilePhoto.js";


const router = express.Router();

router.get(
  "/profile",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getAdminProfile
);

router.put(
  "/profile",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  updateAdminProfile
);

router.post(
  "/profile/photo",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  uploadProfilePhoto.single("photo"),
  uploadAdminPhoto
);

router.get(
  "/booths",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getAllBoothsHierarchy
);

export default router;
