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


/* =========================
   CREATE ELECTION
========================= */
export const createElection = async (req, res) => {
  try {
    const {
      election_category,
      election_type,
      election_name,
      election_code,
      notification_date,
      poll_date,
      counting_date,
      result_date,
      total_seats,
      total_voters,
      state,
      district,
      description
    } = req.body;


    // 🔐 HARD SAFETY (IMPORTANT)
    if (!election_type) {
      election_type = election_category;
    }

    if (!election_type) {
      return res.status(400).json({
        message: "election_type is required"
      });
    }
    const createdBy = req.user.userId;

    const result = await pool.query(
      `
      INSERT INTO elections (
        election_category,
        election_type,
        election_name,
        election_code,
        notification_date,
        poll_date,
        counting_date,
        result_date,
        total_seats,
        total_voters,
        state,
        district,
        description,
        status,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'upcoming',$14
      )
      RETURNING *
      `,
      [
        election_category,
        election_type,
        election_name,
        election_code,
        notification_date,
        poll_date,
        counting_date,
        result_date,
        total_seats,
        total_voters,
        state,
        district,
        description,
        createdBy
      ]
    );

    res.status(201).json({
      message: "Election created successfully",
      election: result.rows[0]
    });

  } catch (err) {
    console.error("Create election error:", err);

    if (err.code === "23505") {
      return res.status(409).json({ message: "Election code already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE ELECTION
========================= */
export const updateElection = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      election_category,
      election_type,
      election_name,
      notification_date,
      poll_date,
      counting_date,
      result_date,
      total_seats,
      total_voters,
      state,
      district,
      description
    } = req.body;

    await pool.query(
      `
      UPDATE elections
      SET
        election_category = $1,
        election_type = $2,
        election_name = $3,
        notification_date = $4,
        poll_date = $5,
        counting_date = $6,
        result_date = $7,
        total_seats = $8,
        total_voters = $9,
        state = $10,
        district = $11,
        description = $12
      WHERE id = $13
      `,
      [
        election_category,
        election_type,
        election_name,
        notification_date,
        poll_date,
        counting_date,
        result_date,
        total_seats,
        total_voters,
        state,
        district,
        description,
        id
      ]
    );

    res.json({ message: "Election updated successfully" });

  } catch (err) {
    console.error("Update election error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET ALL ELECTIONS
========================= */
export const getAllElections = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.*,
        u.email AS created_by_email
      FROM elections e
      LEFT JOIN users u ON u.id = e.created_by
      ORDER BY e.created_at DESC
      `
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Fetch elections error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET SINGLE ELECTION
========================= */
export const getElectionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM elections WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Election not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Fetch election error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   CHANGE STATUS
========================= */
export const changeElectionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      `
      UPDATE elections
      SET status = $1
      WHERE id = $2
      `,
      [status, id]
    );

    res.json({ message: "Election status updated" });

  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   DELETE ELECTION
========================= */
export const deleteElection = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM elections WHERE id = $1`, [id]);

    res.json({ message: "Election deleted successfully" });

  } catch (err) {
    console.error("Delete election error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =================================================
   GET VOTER PART COUNTS (STATE → DISTRICT → AC → PART)
================================================= */
export const getVoterParts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.state,
        b.district,
        b.ac_name_no AS assembly_constituency,
        b.part_name_no AS part_name,
        COUNT(u.id)::int AS voters
      FROM users u
      JOIN booths b ON b.id = u.permanent_booth_id
      GROUP BY
        b.state,
        b.district,
        b.ac_name_no,
        b.part_name_no
      ORDER BY
        b.state,
        b.district,
        b.ac_name_no,
        b.part_name_no
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Voter parts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET VOTERS BY PART
========================= */
export const getVotersByPart = async (req, res) => {
  try {
    const { part } = req.query;

    if (!part) {
      return res.status(400).json({ message: "Part name required" });
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.voter_id,
        CONCAT(u.first_name, ' ', u.last_name) AS name
      FROM users u
      JOIN booths b ON b.id = u.permanent_booth_id
      WHERE b.part_name_no = $1
      ORDER BY name
      `,
      [part]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Voter list error:", err);
    res.status(500).json({ message: "Server error" });
  }
};