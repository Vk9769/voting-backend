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
      ward_id
    } = req.body;

    if (!voterId || !electionId || !boothId) {
      throw new Error("voterId, electionId and boothId are required");
    }

    /* =========================
       1️⃣ Validate Election
    ========================= */
    const electionRes = await client.query(
      `SELECT id, election_type FROM elections WHERE id = $1`,
      [electionId]
    );

    if (!electionRes.rows.length) {
      throw new Error("Election not found");
    }

    const { election_type } = electionRes.rows[0];

    const isMunicipal =
      election_type.toLowerCase().includes("municipal");

    const isAssembly =
      election_type.toLowerCase().includes("assembly");

    /* =========================
       2️⃣ Check Existing User
    ========================= */
    let userRes = await client.query(
      `SELECT id FROM users WHERE voter_id = $1`,
      [voterId]
    );

    let userId;
    const dobParsed = parseDOB(dob);

    if (userRes.rows.length) {
      // Existing User
      userId = userRes.rows[0].id;

      await client.query(
        `
        UPDATE users
        SET first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            phone = COALESCE($3, phone),
            email = COALESCE($4, email),
            gender = COALESCE($5, gender),
            date_of_birth = COALESCE($6, date_of_birth),
            address = COALESCE($7, address),
            gov_id_type = COALESCE($8, gov_id_type),
            gov_id_no = COALESCE($9, gov_id_no),
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
          userId
        ]
      );
    } else {
      // New User
      if (!password) {
        throw new Error("Password required for new user");
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
          permanent_booth_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
          dobParsed,
          address,
          idType || "Aadhaar",
          idNumber,
          boothId
        ]
      );

      userId = insert.rows[0].id;
    }

    /* =========================
       3️⃣ Assign Roles
    ========================= */
    const roles = await client.query(
      `SELECT id FROM roles WHERE name IN ('VOTER','AGENT')`
    );

    for (let role of roles.rows) {
      await client.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [userId, role.id]
      );
    }

    /* =========================
       4️⃣ Prevent Duplicate Agent
    ========================= */
    const existingAgent = await client.query(
      `
      SELECT id FROM election_agents
      WHERE agent_id = $1 AND election_id = $2
      `,
      [userId, electionId]
    );

    if (existingAgent.rows.length) {
      throw new Error("Agent already assigned in this election");
    }

    if (isMunicipal) {
      const verifyBooth = await client.query(
        `
    SELECT id FROM election_booths
    WHERE election_id = $1
      AND booth_id = $2
      AND ward_id = $3
    `,
        [electionId, boothId, ward_id]
      );

      if (!verifyBooth.rows.length) {
        throw new Error("Invalid booth for this municipal election/ward");
      }
    }

const uploadedPhoto = req.file?.location || null;
    /* =========================
       5️⃣ Insert Agent Assignment
    ========================= */

   await client.query(
  `
  INSERT INTO election_agents (
    agent_id,
    election_id,
    booth_id,
    ward_id,
    assigned_at,
    profile_photo
  )
  VALUES ($1,$2,$3,$4,NOW(),$5)
  `,
  [
    userId,
    electionId,
    boothId,
    isMunicipal ? ward_id : null,
    uploadedPhoto
  ]
);
console.log("Uploaded file:", req.file);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: userRes.rows.length
        ? "Existing voter assigned as agent"
        : "New voter created and assigned as agent"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Agent Error:", err);
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

/* =========================
   LIST AGENTS (ADMIN)
========================= */
export const listAgents = async (req, res) => {
  try {
    const { election_id, area_type, ward_id, assembly } = req.query;

    if (!election_id || !area_type) {
      return res.status(400).json({
        message: "election_id and area_type are required"
      });
    }

    let query = `
      SELECT
        ea.id,
        ea.agent_id,
        ea.election_id,
        ea.booth_id,
        ea.ward_id,
        ea.profile_photo,

        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gender,
        u.date_of_birth,

        b.name AS booth_name,
        b.ac_name_no,
        b.state,
        b.district

      FROM election_agents ea
      JOIN users u ON u.id = ea.agent_id
      JOIN booths b ON b.id = ea.booth_id

      WHERE ea.election_id = $1
    `;

    const params = [election_id];
    let paramIndex = 2;

    /* =========================
       🏛 ASSEMBLY FILTER
    ========================= */
    if (area_type === "AC") {
      if (assembly) {
        query += ` AND b.ac_name_no = $${paramIndex}`;
        params.push(assembly);
        paramIndex++;
      }
    }

    /* =========================
       🏘 MUNICIPAL FILTER
    ========================= */
    if (area_type === "WARD") {
      if (ward_id) {
        query += ` AND ea.ward_id = $${paramIndex}`;
        params.push(ward_id);
        paramIndex++;
      }
    }

    query += ` ORDER BY u.first_name ASC`;

    const result = await pool.query(query, params);

    const agents = result.rows;

for (let agent of agents) {
  if (agent.profile_photo && agent.profile_photo.includes(".amazonaws.com/")) {
    const key = agent.profile_photo
      .split(".amazonaws.com/")[1]
      .replace(/^\/+/, "");

    agent.profile_photo = await getSignedImageUrl(key);
  }
}

res.json(agents);

  } catch (err) {
    console.error("List agents error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET AGENT BY ID (ADMIN)
========================= */
export const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ea.id,
        ea.election_id,
        ea.booth_id,
        ea.ward_id,
        ea.profile_photo,
        ea.nomination_status,
        ea.assigned_at,

        e.election_name,
        e.election_type,

        b.name AS booth_name,
        b.address AS booth_address,
        b.state,
        b.district,
        b.ac_name_no,

        w.ward_name,

        u.id AS user_id,
        u.voter_id,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gender,
        u.date_of_birth,
        u.address,
        u.gov_id_no,
        u.gov_id_type

      FROM election_agents ea
      JOIN users u ON u.id = ea.agent_id
      JOIN elections e ON e.id = ea.election_id
      JOIN booths b ON b.id = ea.booth_id
      LEFT JOIN wards w ON w.id = ea.ward_id

      WHERE ea.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Agent not found" });
    }
    const agent = result.rows[0];
if (agent.profile_photo && agent.profile_photo.includes(".amazonaws.com/")) {
  const key = agent.profile_photo
    .split(".amazonaws.com/")[1]
    .replace(/^\/+/, "");

  agent.profile_photo = await getSignedImageUrl(key);
}

return res.json(agent);

  } catch (err) {
    console.error("Get agent by id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   AGENT COUNTS (ADMIN)
========================= */
export const getAgentCounts = async (req, res) => {
  try {
    const { electionId } = req.params;

    if (!electionId) {
      return res.status(400).json({
        message: "electionId is required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE nomination_status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE nomination_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE nomination_status = 'rejected') AS rejected
      FROM election_agents
      WHERE election_id = $1
      `,
      [electionId]
    );

    const counts = result.rows[0];

    res.json({
      total: parseInt(counts.total),
      approved: parseInt(counts.approved),
      pending: parseInt(counts.pending),
      rejected: parseInt(counts.rejected)
    });

  } catch (err) {
    console.error("Agent count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};