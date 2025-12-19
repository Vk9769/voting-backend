import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";

/* =========================
   GET VOTER PROFILE
========================= */
export const getVoterProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.voter_id,
        u.first_name,
        u.last_name,
        u.relatives_name,
        u.phone,
        u.email,
        u.gov_id_type,
        u.gov_id_no,
        u.profile_photo,
        r.name AS role,

        b.name AS booth_name,
        b.address AS booth_address,

        COALESCE(mv.mark_status, 'Pending') AS voting_status

      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id

      LEFT JOIN election_voters ev ON ev.voter_id = u.id
      LEFT JOIN booths b ON b.id = ev.booth_id
      LEFT JOIN marked_voters mv ON mv.voter_id = u.id

      WHERE u.id = $1
      `,
      [userId]
    );

    if (result.rows[0].profile_photo) {
      const key = result.rows[0].profile_photo.split(".amazonaws.com/")[1];
      result.rows[0].profile_photo =
        await getSignedImageUrl(key);
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Voter not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Voter profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE VOTER PROFILE
========================= */
export const updateVoterProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      first_name,
      last_name,
      relatives_name,
      phone,
      email,
      gov_id_type,
      gov_id_no,
      profile_photo
    } = req.body;

    await pool.query(
      `
      UPDATE users
      SET
        first_name = $1,
        last_name = $2,
        relatives_name = $3,
        phone = $4,
        email = $5,
        gov_id_type = $6,
        gov_id_no = $7,
        profile_photo = $8
      WHERE id = $9
      `,
      [
        first_name,
        last_name,
        relatives_name,
        phone,
        email,
        gov_id_type,
        gov_id_no,
        profile_photo,
        userId
      ]
    );

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update voter error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const uploadVoterPhoto = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file || !req.file.location) {
      return res.status(400).json({ message: "Photo upload failed" });
    }

    const photoUrl = req.file.location;

    await pool.query(
      `
      UPDATE users
      SET profile_photo = $1
      WHERE id = $2
      `,
      [photoUrl, userId]
    );

    res.json({
      message: "Profile photo updated",
      profile_photo: photoUrl
    });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
