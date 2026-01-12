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
      boothId,
      electionId,
      idType,
      idNumber
    } = req.body;

    if (!boothId || !electionId) {
      throw new Error("Booth and Election are required");
    }

    /* =========================
    1️⃣ CHECK USER
 ========================= */
    const existingUser = await client.query(
      `SELECT id FROM users WHERE voter_id = $1`,
      [voterId]
    );

    let userId;
    let isNewUser = false;

    if (existingUser.rows.length) {
      // =========================
      // EXISTING USER
      // =========================
      userId = existingUser.rows[0].id;

      await client.query(
        `
    UPDATE users SET
      first_name = COALESCE($1, first_name),
      last_name  = COALESCE($2, last_name),
      phone      = COALESCE($3, phone),
      email      = COALESCE($4, email),
      gender     = COALESCE($5, gender),
      date_of_birth = COALESCE($6, date_of_birth),
      address    = COALESCE($7, address),
      gov_id_type = COALESCE($8, gov_id_type),
      gov_id_no   = COALESCE($9, gov_id_no),
      permanent_booth_id = $10
    WHERE id = $11
    `,
        [
          firstName,
          lastName,
          phone,
          email,
          gender,
          dob,
          address,
          idType || "Aadhaar",
          idNumber,
          boothId,
          userId
        ]
      );

      // ✅ update photo ONLY if uploaded
      if (req.file?.location) {
        await client.query(
          `UPDATE users SET profile_photo = $1 WHERE id = $2`,
          [req.file.location, userId]
        );
      }

    } else {
      // =========================
      // NEW USER
      // =========================
      isNewUser = true;

      if (!password) {
        throw new Error("Password required for new voter");
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
      address,
      gov_id_type,
      gov_id_no,
      permanent_booth_id,
      profile_photo
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
          address,
          idType || "Aadhaar",
          idNumber,
          boothId,
          req.file?.location || null
        ]
      );

      userId = newUser.rows[0].id;
    }


    /* =========================
       2️⃣ ENSURE VOTER ROLE
    ========================= */
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'VOTER'
      ON CONFLICT DO NOTHING
      `,
      [userId]
    );

    /* =========================
       3️⃣ ENSURE AGENT ROLE
    ========================= */
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'AGENT'
      ON CONFLICT DO NOTHING
      `,
      [userId]
    );

    /* =========================
       4️⃣ ASSIGN ELECTION + BOOTH
    ========================= */
    await client.query(
      `
      INSERT INTO election_agents (
        agent_id,
        election_id,
        booth_id,
        profile_photo
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (agent_id)
      DO UPDATE SET profile_photo = EXCLUDED.profile_photo
      `,
      [
        userId,
        electionId,
        boothId,
        req.file?.location || null
      ]
    );


    await client.query("COMMIT");

    res.json({
      message: isNewUser
        ? "New voter created and assigned as agent"
        : "Existing voter assigned as agent",
      userId,
      electionId,
      boothId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create agent error:", err);
    res.status(500).json({ message: err.message });
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
        ea.profile_photo AS agent_profile_photo
      FROM users u
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
    // ✅ SAFE S3 SIGNING (NO DOUBLE SIGN)
    if (agent.agent_profile_photo) {
      // Already signed → send as-is
      if (agent.agent_profile_photo.includes("X-Amz-Signature")) {
        // do nothing
      }
      // Raw S3 URL → sign once
      else if (agent.agent_profile_photo.includes(".amazonaws.com/")) {
        const key = agent.agent_profile_photo
          .split(".amazonaws.com/")[1]
          .replace(/^\/+/, "");

        agent.agent_profile_photo = await getSignedImageUrl(key);
      }
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

