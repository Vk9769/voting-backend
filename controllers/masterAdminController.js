import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";
import { createNotification } from "./notificationController.js";


/* =========================
   GET MASTER ADMIN PROFILE
========================= */
export const getAdminProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.voter_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gov_id_type,
        u.gov_id_no,
        u.gender,
        u.profile_photo,
        r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      `,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const admin = result.rows[0];

    // ✅ Signed S3 URL
    if (
      admin.profile_photo &&
      admin.profile_photo.includes(".amazonaws.com/")
    ) {
      const key = admin.profile_photo.split(".amazonaws.com/")[1].replace(/^\/+/, "");
      admin.profile_photo = await getSignedImageUrl(key);
    }

    res.json(admin);
  } catch (err) {
    console.error("Admin profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE MASTER ADMIN PROFILE
========================= */
export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      first_name,
      last_name,
      phone,
      email,
      gender,
      gov_id_type,
      gov_id_no,
    } = req.body;

    await pool.query(
      `
      UPDATE users SET
        first_name = $1,
        last_name = $2,
        phone = $3,
        email = $4,
        gender = $5,
        gov_id_type = $6,
        gov_id_no = $7
      WHERE id = $8
      `,
      [
        first_name,
        last_name,
        phone,
        email,
        gender,
        gov_id_type,
        gov_id_no,
        userId,
      ]
    );

    await createNotification(
      userId,
      "Profile Updated",
      "Your admin profile was updated successfully",
      "PROFILE"
    );

    res.json({ message: "Admin profile updated" });
  } catch (err) {
    console.error("Admin update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPLOAD ADMIN PHOTO
========================= */
export const uploadAdminPhoto = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file?.location) {
      return res.status(400).json({ message: "Photo upload failed" });
    }

    await pool.query(
      `UPDATE users SET profile_photo = $1 WHERE id = $2`,
      [req.file.location, userId]
    );

    await createNotification(
      userId,
      "Profile Photo Updated",
      "Your admin profile photo was updated",
      "PROFILE"
    );

    res.json({
      message: "Profile photo updated",
      profile_photo: req.file.location,
    });
  } catch (err) {
    console.error("Admin photo error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

//GET ALL BOOTHS 
export const getAllBoothsHierarchy = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        state,
        district,
        ac_name_no   AS assembly_constituency,
        part_name_no AS part_name,
        COUNT(*)     AS booths
      FROM booths
      GROUP BY state, district, ac_name_no, part_name_no
      ORDER BY state, district, ac_name_no, part_name_no
    `);

    res.json(rows);
  } catch (err) {
    console.error("MasterAdmin booths error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
