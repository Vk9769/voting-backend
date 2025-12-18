import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../services/db.js";

export const login = async (req, res) => {
  try {
    const { identifier, password, app } = req.body;

    if (!identifier || !password || !app) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.voter_id,
        u.email,
        u.phone,
        u.password,
        r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🔐 APP ↔ ROLE VALIDATION
    const appRoleMap = {
      VOTER: ["VOTER"],
      AGENT: ["AGENT", "SUPER_AGENT"],
      BLO: ["BLO"],
      ADMIN: ["ADMIN", "SUPER_ADMIN", "MASTER_ADMIN"],
      OBSERVER: ["OBSERVER"],
      CANDIDATE: ["CANDIDATE"]
    };

    if (!appRoleMap[app] || !appRoleMap[app].includes(user.role)) {
      return res.status(403).json({
        message: "Invalid credentials"
      });
    }

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
