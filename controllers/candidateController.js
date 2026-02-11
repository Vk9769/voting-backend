import { pool } from "../services/db.js";
import bcrypt from "bcryptjs";

/* =====================================================
   CREATE CANDIDATE (UPGRADED)
===================================================== */
export const createCandidate = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      election_id,
      voter_id,
      first_name,
      last_name,
      phone,
      email,
      password,
      gender,
      age,
      party,
      symbol,
      ward_id,
      candidate_type
    } = req.body;

    if (!election_id || !voter_id || !party) {
      return res.status(400).json({
        message: "election_id, voter_id and party are required"
      });
    }

    /* =========================
       1️⃣ Validate Election
    ========================= */
    const electionRes = await client.query(
      `SELECT id, election_type FROM elections WHERE id = $1`,
      [election_id]
    );

    if (!electionRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Election not found" });
    }

    const { election_type } = electionRes.rows[0];

    /* =========================
       2️⃣ Validate Ward (Municipal Only)
    ========================= */
    if (election_type === "Municipal") {
      if (!ward_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "ward_id is required for Municipal elections"
        });
      }

      const wardCheck = await client.query(
        `SELECT id FROM wards WHERE id = $1 AND election_id = $2`,
        [ward_id, election_id]
      );

      if (!wardCheck.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Invalid ward for this election"
        });
      }
    }

    if (election_type === "Assembly" && ward_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "ward_id should not be provided for Assembly elections"
      });
    }

    /* =========================
       3️⃣ Check Existing User
    ========================= */
    let userRes = await client.query(
      `SELECT id FROM users WHERE voter_id = $1`,
      [voter_id]
    );

    let user_id;

    if (userRes.rows.length) {
      user_id = userRes.rows[0].id;
    } else {
      if (!password) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Password required for new user"
        });
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
          age
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
        `,
        [
          voter_id,
          first_name,
          last_name,
          phone,
          email,
          hashedPassword,
          gender,
          age
        ]
      );

      user_id = newUser.rows[0].id;

      /* Assign VOTER role */
      const voterRole = await client.query(
        `SELECT id FROM roles WHERE name = 'VOTER'`
      );

      if (voterRole.rows.length) {
        await client.query(
          `
          INSERT INTO user_roles (user_id, role_id)
          VALUES ($1,$2)
          ON CONFLICT DO NOTHING
          `,
          [user_id, voterRole.rows[0].id]
        );
      }
    }

    /* =========================
       4️⃣ Assign Candidate Role
    ========================= */
    const candidateRole = await client.query(
      `SELECT id FROM roles WHERE name = 'CANDIDATE'`
    );

    if (candidateRole.rows.length) {
      await client.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1,$2)
        ON CONFLICT DO NOTHING
        `,
        [user_id, candidateRole.rows[0].id]
      );
    }

    /* =========================
       5️⃣ Prevent Duplicate
    ========================= */
    const existingCandidate = await client.query(
      `
      SELECT id FROM candidates
      WHERE user_id = $1 AND election_id = $2
      `,
      [user_id, election_id]
    );

    if (existingCandidate.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "User already registered as candidate in this election"
      });
    }

    /* =========================
       6️⃣ Insert Candidate
    ========================= */
    await client.query(
      `
      INSERT INTO candidates (
        user_id,
        election_id,
        party,
        symbol,
        ward_id,
        candidate_type
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        user_id,
        election_id,
        party,
        symbol,
        election_type === "Municipal" ? ward_id : null,
        candidate_type || "party"
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Candidate created successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create candidate error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
