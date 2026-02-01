import { pool } from "../services/db.js";

/* =========================
   CREATE WARD (Municipal)
========================= */
export const createWard = async (req, res) => {
  try {
    const {
      election_id,
      ward_no,
      ward_name,
      description
    } = req.body;

    if (!election_id || !ward_no || !ward_name) {
      return res.status(400).json({
        message: "election_id, ward_no and ward_name are required"
      });
    }

    // 🔐 Ensure election exists
    const electionCheck = await pool.query(
      `SELECT id FROM elections WHERE id = $1`,
      [election_id]
    );

    if (!electionCheck.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    const result = await pool.query(
      `
      INSERT INTO wards (
        election_id,
        ward_no,
        ward_name,
        description
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [election_id, ward_no, ward_name, description || null]
    );

    res.status(201).json({
      message: "Ward created successfully",
      ward: result.rows[0]
    });

  } catch (err) {
    console.error("Create ward error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET WARDS BY ELECTION
========================= */
export const getWardsByElection = async (req, res) => {
  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({
        message: "election_id is required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        ward_no,
        ward_name,
        description,
        created_at
      FROM wards
      WHERE election_id = $1
      ORDER BY ward_no
      `,
      [election_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Fetch wards error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET SINGLE WARD
========================= */
export const getWardById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM wards
      WHERE id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Ward not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Fetch ward error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE WARD
========================= */
export const updateWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { ward_no, ward_name, description } = req.body;

    const result = await pool.query(
      `
      UPDATE wards
      SET
        ward_no = COALESCE($1, ward_no),
        ward_name = COALESCE($2, ward_name),
        description = COALESCE($3, description)
      WHERE id = $4
      RETURNING *
      `,
      [ward_no, ward_name, description, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Ward not found" });
    }

    res.json({
      message: "Ward updated successfully",
      ward: result.rows[0]
    });

  } catch (err) {
    console.error("Update ward error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   DELETE WARD
========================= */
export const deleteWard = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM wards WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Ward not found" });
    }

    res.json({ message: "Ward deleted successfully" });

  } catch (err) {
    console.error("Delete ward error:", err);

    // FK safety (voters / agents / booths may exist)
    if (err.code === "23503") {
      return res.status(409).json({
        message: "Cannot delete ward. It is already used in this election."
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};
