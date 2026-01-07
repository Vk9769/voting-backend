import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";
import { createNotification } from "./notificationController.js";

/* =========================
   GET AGENT PROFILE
========================= */
export const getAgentProfile = async (req, res) => {
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
      return res.status(404).json({ message: "Agent not found" });
    }

    const agent = result.rows[0];

    // ✅ Signed S3 URL
    if (
      agent.profile_photo &&
      agent.profile_photo.includes(".amazonaws.com/")
    ) {
      const key = agent.profile_photo
        .split(".amazonaws.com/")[1]
        .replace(/^\/+/, "");
      agent.profile_photo = await getSignedImageUrl(key);
    }

    res.json({ data: agent });
  } catch (err) {
    console.error("Agent profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE AGENT PROFILE
========================= */
export const updateAgentProfile = async (req, res) => {
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
        last_name  = $2,
        phone      = $3,
        email      = $4,
        gender     = $5,
        gov_id_type= $6,
        gov_id_no  = $7
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
      "Your agent profile was updated successfully",
      "PROFILE"
    );

    res.json({ message: "Agent profile updated" });
  } catch (err) {
    console.error("Agent update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPLOAD AGENT PHOTO
========================= */
export const uploadAgentPhoto = async (req, res) => {
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
      "Your agent profile photo was updated",
      "PROFILE"
    );

    res.json({
      message: "Profile photo updated",
      profile_photo: req.file.location,
    });
  } catch (err) {
    console.error("Agent photo error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
