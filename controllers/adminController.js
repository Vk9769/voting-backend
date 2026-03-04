import { pool } from "../services/db.js";
import bcrypt from "bcryptjs";
import { getSignedImageUrl } from "../services/s3.js";

const parseDOB = (dob) => {
  if (!dob) return null;

  if (dob.includes("-")) {
    const [dd, mm, yyyy] = dob.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

/* =========================
   CREATE DISTRICT ADMIN
========================= */
export const createAdmin = async (req, res) => {
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
      district,
      idType,
      idNumber
    } = req.body;

    if (!voterId || !electionId || !state || !district) {
      throw new Error("voterId, electionId, state and district are required");
    }

    /* =========================
       VALIDATE ELECTION
    ========================= */
    const electionRes = await client.query(
      `SELECT id FROM elections WHERE id=$1`,
      [electionId]
    );

    if (!electionRes.rows.length) {
      throw new Error("Election not found");
    }

    /* =========================
       CHECK EXISTING USER
    ========================= */

    let userRes = await client.query(
      `SELECT id FROM users WHERE voter_id=$1`,
      [voterId]
    );

    let userId;
    const dobParsed = parseDOB(dob);

    if (userRes.rows.length) {

      userId = userRes.rows[0].id;

      await client.query(
        `
        UPDATE users
        SET
          first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          gender = COALESCE($5, gender),
          date_of_birth = COALESCE($6, date_of_birth),
          address = COALESCE($7, address),
          gov_id_type = COALESCE($8, gov_id_type),
          gov_id_no = COALESCE($9, gov_id_no)
        WHERE id=$10
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
        INSERT INTO users(
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
       ASSIGN ADMIN ROLE
    ========================= */

    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name='ADMIN'`
    );

    if (!roleRes.rows.length) {
      throw new Error("ADMIN role not found");
    }

    await client.query(
      `
      INSERT INTO user_roles(user_id, role_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleRes.rows[0].id]
    );

    /* =========================
       PREVENT DUPLICATE
    ========================= */

    const existing = await client.query(
      `
      SELECT id FROM election_admins
      WHERE admin_id=$1
      AND election_id=$2
      AND district=$3
      `,
      [userId, electionId, district]
    );

    if (existing.rows.length) {
      throw new Error("Admin already assigned for this district");
    }

    const uploadedPhoto = req.file?.location || null;

    /* =========================
       INSERT ASSIGNMENT
    ========================= */

    await client.query(
      `
      INSERT INTO election_admins(
        admin_id,
        election_id,
        state,
        district,
        assigned_at,
        profile_photo
      )
      VALUES ($1,$2,$3,$4,NOW(),$5)
      `,
      [userId, electionId, state, district, uploadedPhoto]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Admin created successfully"
    });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("Create Admin Error:", err);

    res.status(500).json({
      message: err.message
    });

  } finally {
    client.release();
  }
};

/********************
 LIST ADMINS
********************/

export const listAdmins = async (req, res) => {
  try {

    const { election_id, state, district } = req.query;

    let query = `
    SELECT
      ea.id,
      ea.election_id,
      ea.state,
      ea.district,
      ea.nomination_status,
      ea.profile_photo,
      ea.assigned_at,

      u.first_name,
      u.last_name,
      u.phone,
      u.email,
      u.gender,

      e.election_name

    FROM election_admins ea
    JOIN users u ON u.id = ea.admin_id
    JOIN elections e ON e.id = ea.election_id
    WHERE 1=1
    `;

    const params = [];
    let i = 1;

    if (election_id) {
      query += ` AND ea.election_id=$${i++}`;
      params.push(election_id);
    }

    if (state) {
      query += ` AND ea.state=$${i++}`;
      params.push(state);
    }

    if (district) {
      query += ` AND ea.district=$${i++}`;
      params.push(district);
    }

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/********************
 DELETE ADMIN
 ********************/

export const deleteAdmin = async (req, res) => {
  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const { id } = req.params;

    const adminRes = await client.query(
      `SELECT admin_id FROM election_admins WHERE id=$1`,
      [id]
    );

    if (!adminRes.rows.length) {
      throw new Error("Admin not found");
    }

    const userId = adminRes.rows[0].admin_id;

    await client.query(
      `DELETE FROM election_admins WHERE id=$1`,
      [id]
    );

    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name='ADMIN'`
    );

    if (roleRes.rows.length) {
      await client.query(
        `DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2`,
        [userId, roleRes.rows[0].id]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Admin removed successfully"
    });

  } catch (err) {

    await client.query("ROLLBACK");

    res.status(500).json({ message: err.message });

  } finally {
    client.release();
  }
};

/********************
 GET ADMIN COUNTS
  ********************/
 export const getAdminCounts = async (req, res) => {

  try {

    const { election_id, state, district } = req.query;

    const result = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE nomination_status='approved') AS approved,
        COUNT(*) FILTER (WHERE nomination_status='pending') AS pending,
        COUNT(*) FILTER (WHERE nomination_status='rejected') AS rejected
      FROM election_admins
      WHERE election_id=$1
      AND state=$2
      AND district=$3
      `,
      [election_id, state, district]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

};

/********************
 GET ADMIN BY ID
  ********************/
export const getAdminById = async (req, res) => {

  try {

    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ea.*,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gender,
        u.address,
        u.voter_id,
        u.date_of_birth
      FROM election_admins ea
      JOIN users u ON u.id = ea.admin_id
      WHERE ea.id=$1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

};

/********************
 * UPDATE ADMIN
 ********************/
export const updateAdmin = async (req, res) => {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const { id } = req.params;
    const { nomination_status } = req.body;

    await client.query(
      `
      UPDATE election_admins
      SET nomination_status=$1
      WHERE id=$2
      `,
      [nomination_status, id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Admin updated successfully"
    });

  } catch (err) {

    await client.query("ROLLBACK");

    res.status(500).json({ message: "Server error" });

  } finally {
    client.release();
  }

};