import { pool } from "../services/db.js";

/* =====================================================
   GET AVAILABLE BOOTHS FOR ELECTION
   - Election defines state + district
   - Filters AC-wise OR Ward-wise
   - Excludes already allocated booths
===================================================== */
export const getBoothsForElection = async (req, res) => {
  try {
    const { election_id, ac_name_no, ward_id } = req.query;

    if (!election_id) {
      return res.status(400).json({ message: "election_id is required" });
    }

    // 🔐 Fetch election scope
    const electionRes = await pool.query(
      `
      SELECT state, district, election_type
      FROM elections
      WHERE id = $1
      `,
      [election_id]
    );

    if (!electionRes.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    const { state, district } = electionRes.rows[0];

    let whereClause = `
      WHERE b.state = $2
        AND b.district = $3
        AND b.id NOT IN (
          SELECT booth_id
          FROM election_booths
          WHERE election_id = $1
        )
    `;

    const params = [election_id, state, district];

    // 🏛️ Assembly → AC wise
    if (ac_name_no) {
      whereClause += ` AND b.ac_name_no = $4`;
      params.push(ac_name_no);
    }

    // 🏘️ Municipal → Ward wise
    if (ward_id) {
      whereClause += ` AND b.ward_id = $4`;
      params.push(ward_id);
    }

    const result = await pool.query(
      `
      SELECT
        b.id,
        b.name,
        b.address,
        b.ac_name_no,
        b.ward_id,
        w.ward_no,
        w.ward_name
      FROM booths b
      LEFT JOIN wards w ON w.id = b.ward_id
      ${whereClause}
      ORDER BY b.name
      `,
      params
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Get booths for election error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET AVAILABLE ACs FOR ELECTION (Assembly only)
===================================================== */
export const getACsForElection = async (req, res) => {
  try {
    const { election_id } = req.query;

    if (!election_id) {
      return res.status(400).json({ message: "election_id is required" });
    }

    // Get election scope
    const electionRes = await pool.query(
      `
      SELECT state, district, election_type
      FROM elections
      WHERE id = $1
      `,
      [election_id]
    );

    if (!electionRes.rows.length) {
      return res.status(404).json({ message: "Election not found" });
    }

    const { state, district, election_type } = electionRes.rows[0];

    if (election_type !== "Assembly") {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT DISTINCT b.ac_name_no
      FROM booths b
      WHERE b.state = $2
        AND b.district = $3
        AND b.ac_name_no IS NOT NULL
        AND b.ac_name_no <> ''
        AND b.id NOT IN (
          SELECT booth_id
          FROM election_booths
          WHERE election_id = $1
        )
      ORDER BY b.ac_name_no
      `,
      [election_id, state, district]
    );

    res.json(result.rows.map(r => r.ac_name_no));

  } catch (err) {
    console.error("Get ACs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
