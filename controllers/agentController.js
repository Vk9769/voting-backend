import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";
import { createNotification } from "./notificationController.js";
import bcrypt from "bcryptjs";

/* =========================
   CREATE AGENT 
========================= */
export const createAgent = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      firstName,
      lastName,
      voterId,
      phone,
      email,
      password,
      gender,
      dob,
      address,
      boothId
    } = req.body;

    // =========================
    // 1️⃣ CHECK VOTER EXISTENCE
    // =========================
    const existingUser = await client.query(
      `SELECT id FROM users WHERE voter_id = $1`,
      [voterId]
    );

    let userId;
    let isNewUser = false;

    if (existingUser.rows.length > 0) {
      // ✅ VOTER EXISTS → DO NOT TOUCH USER DATA
      userId = existingUser.rows[0].id;
    } else {
      // ❌ NEW VOTER → CREATE USER
      isNewUser = true;

      if (!password) {
        throw new Error("Password is required for new user");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await client.query(
        `
        INSERT INTO users (
          voter_id,
          first_name,
          last_name,
          phone,
          email,
          password,
          gender,
          date_of_birth,
          address
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
        `,
        [
          voterId,
          firstName,
          lastName,
          phone,
          email,
          hashedPassword,
          gender,
          dob,
          address
        ]
      );

      userId = newUser.rows[0].id;
    }

    // =========================
    // 2️⃣ ASSIGN AGENT ROLE
    // =========================
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'AGENT'
      ON CONFLICT DO NOTHING
      `,
      [userId]
    );

    // =========================
    // 3️⃣ ASSIGN BOOTH + PHOTO
    // =========================
    await client.query(
      `
      INSERT INTO election_agents (
        agent_id,
        booth_id,
        profile_photo
      )
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [
        userId,
        boothId,
        // ✅ upload photo ONLY for new user
        isNewUser ? req.file?.location || null : null
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      message: isNewUser
        ? "New agent created and assigned successfully"
        : "Existing voter assigned as agent successfully",
      userId,
      boothId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create agent error:", err);

    res.status(500).json({
      message: err.message || "Server error"
    });

  } finally {
    client.release();
  }
};


/* =========================
   GET AGENT PROFILE
========================= */
export const getAgentProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.voter_id,
        u.first_name,
        u.last_name,
        u.relatives_name,
        u.phone,
        u.email,
        u.gov_id_type,
        u.gov_id_no,
        u.gender,
        ea.profile_photo AS agent_profile_photo,
        r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN election_agents ea ON ea.agent_id = u.id
      WHERE u.id = $1
      `,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const agent = result.rows[0];

    // ✅ Sign ONLY agent photo
    if (
      agent.agent_profile_photo &&
      agent.agent_profile_photo.includes(".amazonaws.com/")
    ) {
      const key = agent.agent_profile_photo
        .split(".amazonaws.com/")[1]
        .replace(/^\/+/, "");

      agent.agent_profile_photo = await getSignedImageUrl(key);
    }

    res.json({ data: agent });
  } catch (err) {
    console.error("Agent profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   UPDATE AGENT PROFILE
========================= */
export const updateAgentProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const {
      first_name,
      last_name,
      relatives_name,
      phone,
      email,
      gender,
      gov_id_type,
      gov_id_no,
    } = req.body;

    await pool.query(
      `
      UPDATE users
      SET
        first_name = $1,
        last_name = $2,
        relatives_name = $3,
        phone = $4,
        email = $5,
        gov_id_type = $6,
        gov_id_no = $7
      WHERE id = $8
      `,
      [
        first_name,
        last_name,
        relatives_name,
        phone,
        email,
        gov_id_type,
        gov_id_no,
        userId
      ]
    );

    await createNotification(
      userId,
      "Profile Updated",
      "Your agent profile was updated successfully",
      "PROFILE"
    );

    res.json({ message: "Agent profile updated" });
  } catch (err) {
    console.error("Agent update error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPLOAD AGENT PHOTO
========================= */
export const uploadAgentPhoto = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file?.location) {
      return res.status(400).json({ message: "Photo upload failed" });
    }

    const result = await pool.query(
      `
      UPDATE election_agents
      SET profile_photo = $1
      WHERE agent_id = $2
      RETURNING id
      `,
      [req.file.location, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Agent assignment not found"
      });
    }

    await createNotification(
      userId,
      "Agent Photo Updated",
      "Your agent profile photo was updated",
      "PROFILE"
    );

    res.json({
      message: "Agent photo updated",
      profile_photo: req.file.location,
    });

  } catch (err) {
    console.error("Agent photo error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

