import { pool } from "../services/db.js";
import bcrypt from "bcryptjs";
import { getSignedImageUrl } from "../services/s3.js";

/* =====================================================
   CREATE CANDIDATE (FINAL CLEAN S3 VERSION)
===================================================== */
export const createCandidate = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* =========================
       0️⃣ Extract Uploaded Files
    ========================= */
    const candidatePhotoKey =
      req.files?.candidate_photo?.[0]?.key || null;

    const partySymbolKey =
      req.files?.party_symbol?.[0]?.key || null;

    if (!candidatePhotoKey || !partySymbolKey) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Candidate photo and party symbol are required",
      });
    }

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
      ward_id,
      candidate_type,
    } = req.body;

    if (!election_id || !voter_id || !party) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "election_id, voter_id and party are required",
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

    const isMunicipal =
      election_type.toLowerCase().includes("municipal");

    const isAssembly =
      election_type.toLowerCase().includes("assembly");

    /* =========================
       2️⃣ Validate Ward
    ========================= */
    if (isMunicipal) {
      if (!ward_id) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "ward_id is required for Municipal elections",
        });
      }

      const wardCheck = await client.query(
        `SELECT id FROM wards WHERE id = $1 AND election_id = $2`,
        [ward_id, election_id]
      );

      if (!wardCheck.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Invalid ward for this election",
        });
      }
    }

    if (isAssembly && ward_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "ward_id should not be provided for Assembly elections",
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

      // 🔥 Update basic details ONLY (not profile_photo)
      await client.query(
        `
        UPDATE users
        SET first_name = $1,
            last_name = $2,
            phone = $3,
            email = $4,
            gender = $5,
            age = $6
        WHERE id = $7
        `,
        [
          first_name,
          last_name,
          phone,
          email,
          gender,
          age,
          user_id,
        ]
      );
    } else {
      if (!password) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Password required for new user",
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
          age,
        ]
      );

      user_id = newUser.rows[0].id;

      // Assign VOTER role
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
        message:
          "User already registered as candidate in this election",
      });
    }

    /* =========================
       6️⃣ Insert Candidate (CORRECTED)
    ========================= */
    await client.query(
      `
      INSERT INTO candidates (
        user_id,
        election_id,
        party,
        symbol,
        candidate_photo,
        ward_id,
        candidate_type
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        user_id,
        election_id,
        party,
        partySymbolKey,
        candidatePhotoKey,
        isMunicipal ? ward_id : null,
        candidate_type || "party",
      ]
    );

    await client.query("COMMIT");

    res.json({
      message: "Candidate created successfully",
      candidate_photo: candidatePhotoKey,
      party_symbol: partySymbolKey,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create candidate error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

/* =====================================================
   LIST CANDIDATES WITH SIGNED URLS
===================================================== */
export const listCandidates = async (req, res) => {
  try {
    const { election_id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        c.id,
        c.party,
        c.symbol,
        c.candidate_photo,
        c.nomination_status,
        c.ward_id,
        u.first_name,
        u.last_name
      FROM candidates c
      JOIN users u ON u.id = c.user_id
      WHERE c.election_id = $1
      ORDER BY c.id DESC
      `,
      [election_id]
    );

    const candidates = await Promise.all(
      result.rows.map(async (candidate) => {
        const photoUrl = candidate.candidate_photo
          ? await getSignedImageUrl(candidate.candidate_photo)
          : null;

        const symbolUrl = candidate.symbol
          ? await getSignedImageUrl(candidate.symbol)
          : null;

        return {
          ...candidate,
          candidate_photo_url: photoUrl,
          party_symbol_url: symbolUrl,
        };
      })
    );

    res.json(candidates);
  } catch (err) {
    console.error("List candidates error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET SINGLE CANDIDATE
===================================================== */
export const getCandidateById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        c.*,
        u.first_name,
        u.last_name,
        u.phone,
        u.email,
        u.gender,
        u.age
      FROM candidates c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const candidate = result.rows[0];

    candidate.candidate_photo_url =
      candidate.candidate_photo
        ? await getSignedImageUrl(candidate.candidate_photo)
        : null;

    candidate.party_symbol_url =
      candidate.symbol
        ? await getSignedImageUrl(candidate.symbol)
        : null;

    res.json(candidate);

  } catch (err) {
    console.error("Get candidate error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE CANDIDATE
===================================================== */
export const updateCandidate = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const {
      first_name,
      last_name,
      phone,
      email,
      gender,
      age,
      party,
      ward_id,
      nomination_status
    } = req.body;

    const candidatePhotoKey =
      req.files?.candidate_photo?.[0]?.key || null;

    const partySymbolKey =
      req.files?.party_symbol?.[0]?.key || null;

    const candidateRes = await client.query(
      `SELECT user_id FROM candidates WHERE id = $1`,
      [id]
    );

    if (!candidateRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Candidate not found" });
    }

    const user_id = candidateRes.rows[0].user_id;

    // Update user table
    await client.query(
      `
      UPDATE users
      SET first_name=$1,
          last_name=$2,
          phone=$3,
          email=$4,
          gender=$5,
          age=$6
      WHERE id=$7
      `,
      [first_name, last_name, phone, email, gender, age, user_id]
    );

    // Update candidate table
    await client.query(
      `
      UPDATE candidates
      SET party=$1,
          ward_id=$2,
          nomination_status=$3,
          symbol = COALESCE($4, symbol),
          candidate_photo = COALESCE($5, candidate_photo)
      WHERE id=$6
      `,
      [
        party,
        ward_id || null,
        nomination_status,
        partySymbolKey,
        candidatePhotoKey,
        id
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Candidate updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update candidate error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

/* =====================================================
   DELETE CANDIDATE
===================================================== */
export const deleteCandidate = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const result = await client.query(
      `SELECT user_id, nomination_status 
       FROM candidates 
       WHERE id = $1`,
      [id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Candidate not found" });
    }

    if (result.rows[0].nomination_status === "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Approved candidate cannot be deleted",
      });
    }

    await client.query(
      `DELETE FROM candidates WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "Candidate deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete candidate error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
