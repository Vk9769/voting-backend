// super admin controller placeholder
import { pool } from "../services/db.js";
import { getSignedImageUrl } from "../services/s3.js";
import bcrypt from "bcryptjs";

/* =========================
   HELPERS
========================= */
const parseDOB = (dob) => {
  if (!dob) return null;
  if (dob.includes("-")) {
    const [dd, mm, yyyy] = dob.split("-");
    if (dd && mm && yyyy) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
};

/* =========================
   CREATE SUPER ADMIN
========================= */
export const createSuperAdmin = async (req, res) => {
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
      electionId,
      state,
      idType,
      idNumber
    } = req.body;

    if (!voterId || !electionId || !state) {
      throw new Error("voterId, electionId and state are required");
    }

    /* =========================
       1️⃣ Validate Election
    ========================= */
    const electionRes = await client.query(
      `SELECT id FROM elections WHERE id = $1`,
      [electionId]
    );

    if (!electionRes.rows.length) {
      throw new Error("Election not found");
    }

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
      // Existing user
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
            gov_id_no = COALESCE($9, gov_id_no)
        WHERE id = $10
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
          userId
        ]
      );
    } else {
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
          gov_id_no
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
          idNumber
        ]
      );

      userId = insert.rows[0].id;
    }

    /* =========================
       3️⃣ Assign SUPER_ADMIN Role
    ========================= */
    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`
    );

    if (!roleRes.rows.length) {
      throw new Error("SUPER_ADMIN role not found");
    }

    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleRes.rows[0].id]
    );

    /* =========================
       4️⃣ Prevent Duplicate Assignment
    ========================= */
    const existing = await client.query(
      `
      SELECT id FROM election_super_admins
      WHERE super_admin_id = $1
        AND election_id = $2
        AND state = $3
      `,
      [userId, electionId, state]
    );

    if (existing.rows.length) {
      throw new Error("Super Admin already assigned for this state and election");
    }

    const uploadedPhoto = req.file?.location || null;

    /* =========================
       5️⃣ Insert Assignment
    ========================= */
    await client.query(
      `
      INSERT INTO election_super_admins (
        super_admin_id,
        election_id,
        state,
        assigned_at,
        profile_photo
      )
      VALUES ($1,$2,$3,NOW(),$4)
      `,
      [userId, electionId, state, uploadedPhoto]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Super Admin created successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create Super Admin Error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

export const listSuperAdmins = async (req, res) => {
  try {
    const { election_id, state } = req.query;

    let query = `
      SELECT
        esa.id,
        esa.election_id,
        esa.state,
        esa.assigned_at,
        esa.profile_photo,

        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gender,

        e.election_name

      FROM election_super_admins esa
      JOIN users u ON u.id = esa.super_admin_id
      JOIN elections e ON e.id = esa.election_id
      WHERE 1=1
    `;

    const params = [];
    let index = 1;

    if (election_id) {
      query += ` AND esa.election_id = $${index++}`;
      params.push(election_id);
    }

    if (state) {
      query += ` AND esa.state = $${index++}`;
      params.push(state);
    }

    const result = await pool.query(query, params);

    const admins = result.rows;

    for (let admin of admins) {
      if (admin.profile_photo && admin.profile_photo.includes(".amazonaws.com/")) {
        const key = admin.profile_photo
          .split(".amazonaws.com/")[1]
          .replace(/^\/+/, "");

        admin.profile_photo = await getSignedImageUrl(key);
      }
    }

    res.json(admins);

  } catch (err) {
    console.error("List Super Admin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteSuperAdmin = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const adminRes = await client.query(
      `SELECT super_admin_id FROM election_super_admins WHERE id = $1`,
      [id]
    );

    if (!adminRes.rows.length) {
      throw new Error("Super Admin not found");
    }

    const userId = adminRes.rows[0].super_admin_id;

    await client.query(
      `DELETE FROM election_super_admins WHERE id = $1`,
      [id]
    );

    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name = 'SUPER_ADMIN'`
    );

    if (roleRes.rows.length) {
      await client.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
        [userId, roleRes.rows[0].id]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true, message: "Super Admin removed successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete Super Admin error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

