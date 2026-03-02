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
        esa.nomination_status,
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


export const getSuperAdminCounts = async (req, res) => {
  try {
    const { election_id, state } = req.query;

    if (!election_id || !state) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    const result = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE nomination_status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE nomination_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE nomination_status = 'rejected') AS rejected
      FROM election_super_admins
      WHERE election_id = $1 AND state = $2
      `,
      [election_id, state]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET SUPER ADMIN BY ID (ADMIN)
========================= */
export const getSuperAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        esa.id,
        esa.election_id,
        esa.state,
        esa.profile_photo,
        esa.nomination_status,
        esa.assigned_at,
        esa.approved_at,
        esa.rejected_at,

        approver.first_name AS approved_by_name,
        approver.last_name AS approved_by_last,
        rejector.first_name AS rejected_by_name,
        rejector.last_name AS rejected_by_last,

        e.election_name,

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

      FROM election_super_admins esa
      JOIN users u ON u.id = esa.super_admin_id
      JOIN elections e ON e.id = esa.election_id
      LEFT JOIN users approver ON approver.id = esa.approved_by
      LEFT JOIN users rejector ON rejector.id = esa.rejected_by

      WHERE esa.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Super Admin not found" });
    }

    const admin = result.rows[0];

    // ✅ SAFE S3 SIGNING
    if (admin.profile_photo && admin.profile_photo.includes(".amazonaws.com/")) {
      const key = admin.profile_photo
        .split(".amazonaws.com/")[1]
        .replace(/^\/+/, "");

      admin.profile_photo = await getSignedImageUrl(key);
    }

    res.json(admin);

  } catch (err) {
    console.error("Get Super Admin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE SUPER ADMIN (ADMIN)
========================= */
export const updateSuperAdmin = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { nomination_status } = req.body;

    if (!nomination_status) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "nomination_status is required",
      });
    }

    const adminRes = await client.query(
      `SELECT nomination_status FROM election_super_admins WHERE id = $1`,
      [id]
    );

    if (!adminRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Super Admin not found" });
    }


    let approved_by = null;
    let approved_at = null;
    let rejected_by = null;
    let rejected_at = null;

    if (nomination_status === "approved") {
      approved_by = req.user.userId;
      approved_at = new Date();
    }

    if (nomination_status === "rejected") {
      rejected_by = req.user.userId;
      rejected_at = new Date();
    }

    await client.query(
      `
      UPDATE election_super_admins
      SET nomination_status = $1,
          approved_by = $2,
          approved_at = $3,
          rejected_by = $4,
          rejected_at = $5
      WHERE id = $6
      `,
      [
        nomination_status,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        id
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Super Admin ${nomination_status} successfully`,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update Super Admin error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

export const updateSuperAdminFull = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const {
      firstName,
      lastName,
      voterId,
      phone,
      email,
      gender,
      dob,
      address,
      electionId,
      state,
      idType,
      idNumber
    } = req.body;

    const dobParsed = parseDOB(dob);

    /* =========================
       1️⃣ Get existing super admin
    ========================= */
    const adminRes = await client.query(
      `SELECT super_admin_id FROM election_super_admins WHERE id = $1`,
      [id]
    );

    if (!adminRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Super Admin not found" });
    }

    const userId = adminRes.rows[0].super_admin_id;

    /* =========================
       2️⃣ Update USERS table
    ========================= */
    await client.query(
      `
      UPDATE users
      SET first_name = $1,
          last_name = $2,
          phone = $3,
          email = $4,
          gender = $5,
          date_of_birth = $6,
          address = $7,
          gov_id_type = $8,
          gov_id_no = $9
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

    /* =========================
       3️⃣ Handle Profile Photo
    ========================= */
    let profilePhoto = null;

    if (req.file?.location) {
      profilePhoto = req.file.location;
    }

    /* =========================
       4️⃣ Update election_super_admins
    ========================= */
    await client.query(
      `
      UPDATE election_super_admins
      SET election_id = $1,
          state = $2,
          profile_photo = COALESCE($3, profile_photo)
      WHERE id = $4
      `,
      [
        electionId,
        state,
        profilePhoto,
        id
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Super Admin updated successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Full update Super Admin error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};