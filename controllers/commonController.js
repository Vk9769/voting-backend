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
