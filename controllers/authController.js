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
        ARRAY_AGG(r.name) AS roles
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.voter_id = $1
        OR u.email = $1
        OR u.phone = $1
      GROUP BY u.id
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

    // 🔒 APP → ROLE MAPPING
    const appRoleMap = {
      VOTER: "VOTER",
      AGENT: "AGENT",
      BLO: "BLO",
      SUPER_AGENT: "SUPER_AGENT",
      MASTER_AGENT: "MASTER_AGENT",
      OBSERVER: "OBSERVER",
      CANDIDATE: "CANDIDATE",
      ADMIN: "ADMIN",
      SUPER_ADMIN: "SUPER_ADMIN",
      MASTER_ADMIN: "MASTER_ADMIN",
    };

    if (!appRoleMap[app] || !appRoleMap[app].includes(user.role)) {
      return res.status(403).json({
        message: "Invalid credentials"
      });
    }

    const primaryRole = allowedRoles.find(r => user.roles.includes(r));

    const token = jwt.sign(
      { userId: user.id, role: primaryRole },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        role: primaryRole,
        roles: user.roles,
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
