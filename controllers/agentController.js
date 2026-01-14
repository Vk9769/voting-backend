import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";
import { createNotification } from "./notificationController.js";
import bcrypt from "bcryptjs";


/* =========================
   HELPERS
========================= */
const parseDOB = (dob) => {
  if (!dob) return null;
  // Expecting DD-MM-YYYY
  if (dob.includes("-")) {
    const [dd, mm, yyyy] = dob.split("-");
    if (dd && mm && yyyy) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
};

/* =========================
   CREATE AGENT
========================= */
export const createAgent = async (req, res) => {

  console.log("🟢 CREATE AGENT REQUEST");
  console.log("REQ BODY:", req.body);
  console.log("REQ FILE:", req.file?.location);

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
      idNumber,
    } = req.body;

    if (!voterId) {
      throw new Error("voterId missing from request body");
    }


    if (!boothId || !electionId) {
      throw new Error("Booth and Election are required");
    }

    const dobParsed = parseDOB(dob);

    /* =========================
       1️⃣ CHECK USER
    ========================= */
    const { rows } = await client.query(
      `SELECT id, profile_photo FROM users WHERE voter_id = $1`,
      [voterId]
    );

    let userId;
    let isNewUser = false;
    let userProfilePhoto = null;

    if (rows.length) {
      // 🔁 EXISTING VOTER
      userId = rows[0].id;
      userProfilePhoto = rows[0].profile_photo;

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
          dobParsed,
          address,
          idType || "Aadhaar",
          idNumber,
          boothId,
          userId,
        ]
      );
    } else {
      // 🆕 NEW VOTER
      isNewUser = true;

      if (!password) {
        throw new Error("Password required for new voter");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const insert = await client.query(
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
        RETURNING id, profile_photo
        `,
        [
          voterId,
          firstName,
          lastName,
          phone,
          email,
          hashedPassword,
          gender,
          dobParsed,
          address,
          idType || "Aadhaar",
          idNumber,
          boothId,
          req.file?.location || null,
        ]
      );

      userId = insert.rows[0].id;
      userProfilePhoto = insert.rows[0].profile_photo;
    }

    /* =========================
       2️⃣ UPDATE USER PHOTO IF UPLOADED
    ========================= */
    if (req.file?.location) {
      await client.query(
        `UPDATE users SET profile_photo = $1 WHERE id = $2`,
        [req.file.location, userId]
      );
      userProfilePhoto = req.file.location;
    }

    /* =========================
       3️⃣ ENSURE ROLES
    ========================= */
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'VOTER'
      ON CONFLICT DO NOTHING
      `,
      [userId]
    );

    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, id FROM roles WHERE name = 'AGENT'
      ON CONFLICT DO NOTHING
      `,
      [userId]
    );

    /* =========================
   4️⃣ ASSIGN / REASSIGN AGENT (SAFE)
========================= */

    // 🔎 Check if agent already exists
    const existingAgent = await client.query(
      `SELECT id FROM election_agents WHERE agent_id = $1`,
      [userId]
    );

    if (existingAgent.rows.length) {
      // 🔁 UPDATE EXISTING AGENT ASSIGNMENT
      await client.query(
        `
    UPDATE election_agents
    SET
      election_id = $1,
      booth_id = $2,
      profile_photo = COALESCE($3, profile_photo),
      assigned_at = NOW()
    WHERE agent_id = $4
    `,
        [
          electionId,
          boothId,
          userProfilePhoto,
          userId,
        ]
      );
    } else {
      // 🆕 INSERT NEW AGENT ASSIGNMENT
      await client.query(
        `
    INSERT INTO election_agents (
      agent_id,
      election_id,
      booth_id,
      profile_photo
    )
    VALUES ($1,$2,$3,$4)
    `,
        [
          userId,
          electionId,
          boothId,
          userProfilePhoto,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: isNewUser
        ? "New voter created and assigned as agent"
        : "Existing voter assigned as agent",
      userId,
      electionId,
      boothId,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Create agent error:", err);
    res.status(500).json({ success: false, message: err.message });
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

/* =========================
   GET VOTERS
========================= */

export const getAgentVoters = async (req, res) => {
  try {
    const agentId = req.user.userId;

    // 1️⃣ Get agent assignment
    const agentRes = await pool.query(
      `
      SELECT election_id, booth_id
      FROM election_agents
      WHERE agent_id = $1
      `,
      [agentId]
    );

    if (!agentRes.rows.length) {
      return res.status(404).json({ message: "Agent not assigned" });
    }

    const { election_id, booth_id } = agentRes.rows[0];

    // 2️⃣ Fetch voters directly from USERS using permanent_booth_id
    const voters = await pool.query(
      `
      SELECT
        u.id,
        u.voter_id,
        u.first_name,
        u.last_name,

        mv.mark_status,
        mv.created_at AS marked_at

      FROM users u

      LEFT JOIN marked_voters mv
        ON mv.voter_id = u.id
       AND mv.agent_id = $1
       AND mv.election_id = $2

      WHERE u.permanent_booth_id = $3

      ORDER BY u.first_name
      `,
      [agentId, election_id, booth_id]
    );

    res.json({
      booth_id,
      election_id,
      voters: voters.rows,
    });

  } catch (err) {
    console.error("Fetch voters error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   MARK VOTERS
========================= */

export const markVoter = async (req, res) => {
  const client = await pool.connect();

  try {
    const agentId = req.user.userId;
    const { voterId, status } = req.body;

    await client.query("BEGIN");

    const agentRes = await client.query(
      `SELECT election_id, booth_id FROM election_agents WHERE agent_id = $1`,
      [agentId]
    );

    const { election_id, booth_id } = agentRes.rows[0];

    // UNDO
    if (status === "undo") {
      await client.query(
        `
        DELETE FROM marked_voters
        WHERE voter_id = $1
          AND agent_id = $2
          AND election_id = $3
        `,
        [voterId, agentId, election_id]
      );

      await client.query("COMMIT");
      return res.json({ success: true, message: "Mark removed" });
    }

    // MARK / OUR
    await client.query(
      `
      INSERT INTO marked_voters (
        voter_id,
        agent_id,
        election_id,
        booth_id,
        mark_status
      )
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (voter_id, agent_id, election_id)
      DO UPDATE SET
        mark_status = EXCLUDED.mark_status,
        created_at = NOW()
      `,
      [voterId, agentId, election_id, booth_id, status]
    );

    await client.query("COMMIT");

    res.json({ success: true, status });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Mark voter error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
