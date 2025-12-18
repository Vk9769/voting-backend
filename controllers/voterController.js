import { pool } from "../services/db.js";

export const getVoterProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // ✅ CORRECT

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.voter_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
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
