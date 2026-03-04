import { pool } from "../services/db.js";

/* ============================================
   GET ELECTION TYPE
============================================ */
export const getElectionType = async (req, res) => {
  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({ message: "election_id is required" });
    }

    const result = await pool.query(
      `SELECT election_type FROM elections WHERE id = $1`,
      [election_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Get election type error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================
   SEARCH USER BY VOTER ID
   (Reusable for ALL roles)
============================================ */
export const searchUserByVoterId = async (req, res) => {
  try {
    const { voter_id } = req.query;

    if (!voter_id) {
      return res.status(400).json({ message: "voter_id is required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        voter_id,
        first_name,
        last_name,
        phone,
        email,
        gender,
        age,
        profile_photo
      FROM users
      WHERE voter_id = $1
      `,
      [voter_id]
    );

    res.json(result.rows[0] || null);

  } catch (err) {
    console.error("Search user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* ============================================
   GET STATE FROM ELECTION TABLE
============================================ */
export const getElectionStates = async (req, res) => {
  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({ message: "election_id is required" });
    }

    const result = await pool.query(
      `
      SELECT state
      FROM elections
      WHERE id = $1
      `,
      [election_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    const state = result.rows[0].state;

    if (!state) {
      return res.json([]);
    }

    // Return as array for Flutter compatibility
    res.json([state]);

  } catch (err) {
    console.error("Get election state error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================
   GET DISTRICTS BY STATE + ELECTION
============================================ */
export const getElectionDistricts = async (req, res) => {
  try {
    const { election_id, state } = req.query;

    if (!election_id || !state) {
      return res
        .status(400)
        .json({ message: "election_id and state are required" });
    }

    const result = await pool.query(
      `
      SELECT DISTINCT district
      FROM booths
      WHERE election_id = $1
      AND state = $2
      ORDER BY district
      `,
      [election_id, state]
    );

    const districts = result.rows.map((row) => row.district);

    res.json(districts);

  } catch (err) {
    console.error("Get election districts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};