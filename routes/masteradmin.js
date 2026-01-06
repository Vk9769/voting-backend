import express from "express";
import { authenticate } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleCheck.js";

import {
  getAllBoothsHierarchy,
  getAdminProfile,
  updateAdminProfile,
  uploadAdminPhoto,
  createElection,
  updateElection,
  getAllElections,
  getElectionById,
  changeElectionStatus,
  deleteElection,
  getVoterParts,
  getVotersByPart,
} from "../controllers/masterAdminController.js";

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


/* =========================
   CREATE ELECTION
========================= */
router.post(
  "/elections",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN"),
  createElection
);

/* =========================
   UPDATE ELECTION
========================= */
router.put(
  "/elections/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN"),
  updateElection
);

/* =========================
   GET ALL ELECTIONS
========================= */
router.get(
  "/elections",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN"),
  getAllElections
);

/* =========================
   GET SINGLE ELECTION
========================= */
router.get(
  "/elections/:id",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN"),
  getElectionById
);

/* =========================
   CHANGE STATUS
========================= */
router.patch(
  "/elections/:id/status",
  authenticate,
  allowRoles("MASTER_ADMIN", "SUPER_ADMIN"),
  changeElectionStatus
);

/* =========================
   DELETE ELECTION
========================= */
router.delete(
  "/elections/:id",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  deleteElection
);

/* =========================
   MASTER ADMIN – VOTERS
========================= */

router.get(
  "/voter-parts",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getVoterParts
);

router.get(
  "/voters",
  authenticate,
  allowRoles("MASTER_ADMIN"),
  getVotersByPart
);


export default router;
