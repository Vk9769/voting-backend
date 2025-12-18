import { pool } from "../services/db.js";

export const getVoterProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT 
        id,
        voter_id,
        first_name,
        last_name,
        email,
        phone
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Voter not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Voter profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
