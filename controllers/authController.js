import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../services/db.js";

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    // Find user by voter_id OR email OR phone
    const result = await pool.query(
      `
      SELECT u.*, r.name AS role
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.voter_id = $1
         OR u.email = $1
         OR u.phone = $1
      LIMIT 1
      `,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // JWT payload
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        voter_id: user.voter_id,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
