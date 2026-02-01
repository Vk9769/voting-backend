import { pool } from "../services/db.js";

/* =========================
   CREATE ELECTION BOOTH
   (Municipal / Ward-based)
========================= */
export const createElectionBooth = async (req, res) => {
  try {
    const {
      election_id,
      ward_id,
      booth_name,
      latitude,
      longitude,
      radius
    } = req.body;

    if (!election_id || !ward_id || !booth_name) {
      return res.status(400).json({
        message: "election_id, ward_id and booth_name are required"
      });
    }

    // 🔐 Validate election
    const election = await pool.query(
      `SELECT election_type FROM elections WHERE id = $1`,
      [election_id]
    );

    if (!election.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    // 🔐 Municipal only
    if (!election.rows[0].election_type.toLowerCase().includes("municipal")) {
      return res.status(400).json({
        message: "Election booths are only allowed for Municipal elections"
      });
    }

    // 🔐 Validate ward belongs to election
    const wardCheck = await pool.query(
      `SELECT id FROM wards WHERE id = $1 AND election_id = $2`,
      [ward_id, election_id]
    );

    if (!wardCheck.rows.length) {
      return res.status(400).json({
        message: "Invalid ward for this election"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO election_booths (
        election_id,
        booth_id,
        ward_id,
        booth_name,
        latitude,
        longitude,
        radius
      )
      VALUES ($1, NULL, $2, $3, $4, $5, COALESCE($6, 50))
      RETURNING *
      `,
      [
        election_id,
        ward_id,
        booth_name,
        latitude || null,
        longitude || null,
        radius
      ]
    );

    res.status(201).json({
      message: "Election booth created",
      booth: result.rows[0]
    });

  } catch (err) {
    console.error("Create election booth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET BOOTHS BY ELECTION
========================= */
export const getElectionBoothsByElection = async (req, res) => {
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
        eb.id,
        eb.booth_name,
        eb.latitude,
        eb.longitude,
        eb.radius,
        w.id   AS ward_id,
        w.ward_no,
        w.ward_name
      FROM election_booths eb
      JOIN wards w ON w.id = eb.ward_id
      WHERE eb.election_id = $1
      ORDER BY w.ward_no, eb.booth_name
      `,
      [election_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Fetch election booths error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET BOOTHS BY WARD
========================= */
export const getElectionBoothsByWard = async (req, res) => {
  try {
    const { ward_id } = req.query;

    if (!ward_id) {
      return res.status(400).json({
        message: "ward_id is required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        booth_name,
        latitude,
        longitude,
        radius
      FROM election_booths
      WHERE ward_id = $1
      ORDER BY booth_name
      `,
      [ward_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Fetch booths by ward error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE ELECTION BOOTH
========================= */
export const updateElectionBooth = async (req, res) => {
  try {
    const { id } = req.params;
    const { booth_name, latitude, longitude, radius } = req.body;

    const result = await pool.query(
      `
      UPDATE election_booths
      SET
        booth_name = COALESCE($1, booth_name),
        latitude = COALESCE($2, latitude),
        longitude = COALESCE($3, longitude),
        radius = COALESCE($4, radius)
      WHERE id = $5
      RETURNING *
      `,
      [booth_name, latitude, longitude, radius, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Election booth not found" });
    }

    res.json({
      message: "Election booth updated",
      booth: result.rows[0]
    });

  } catch (err) {
    console.error("Update election booth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   DELETE ELECTION BOOTH
========================= */
export const deleteElectionBooth = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM election_booths WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Election booth not found" });
    }

    res.json({ message: "Election booth deleted" });

  } catch (err) {
    console.error("Delete election booth error:", err);

    // FK safety: voters / agents may exist
    if (err.code === "23503") {
      return res.status(409).json({
        message: "Cannot delete booth. It is already in use."
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};
