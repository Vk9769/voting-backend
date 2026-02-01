import { pool } from "../services/db.js";

/* =====================================================
   ALLOCATE BOOTHS TO ELECTION (BULK)
   - Uses existing booths
   - Supports multi-select
===================================================== */
export const allocateBoothsToElection = async (req, res) => {
    try {
        const { election_id, booth_ids } = req.body;

        if (!election_id || !Array.isArray(booth_ids) || booth_ids.length === 0) {
            return res.status(400).json({
                message: "election_id and booth_ids[] are required"
            });
        }

        // 🔐 Validate election
        const election = await pool.query(
            `SELECT election_type FROM elections WHERE id = $1`,
            [election_id]
        );

        if (!election.rows.length) {
            return res.status(404).json({ message: "Election not found" });
        }

        // ✅ Allocate booths (ward auto-picked from booths table)
        await pool.query(
             `
            INSERT INTO election_booths (election_id, booth_id, ward_id)
            SELECT
                $1,
                b.id,
                b.ward_id
            FROM booths b
            WHERE b.id = ANY($2::int[])
                AND NOT EXISTS (
                SELECT 1
                FROM election_booths eb
                WHERE eb.election_id = $1
                    AND eb.booth_id = b.id
                )
            `,
            [election_id, booth_ids]
        );


        res.json({ message: "Booths allocated successfully" });

    } catch (err) {
        console.error("Allocate booths error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* =====================================================
   GET ALLOCATED BOOTHS BY ELECTION
===================================================== */
export const getElectionBoothsByElection = async (req, res) => {
    try {
        const { election_id } = req.query;

        if (!election_id) {
            return res.status(400).json({ message: "election_id is required" });
        }

        const result = await pool.query(
            `
      SELECT
        eb.id               AS election_booth_id,
        b.id                AS booth_id,
        b.name              AS booth_name,
        b.address,
        b.state,
        b.district,
        b.ac_name_no,
        b.latitude,
        b.longitude,
        b.radius,
        w.id                AS ward_id,
        w.ward_no,
        w.ward_name
      FROM election_booths eb
      JOIN booths b ON b.id = eb.booth_id
      LEFT JOIN wards w ON w.id = b.ward_id
      WHERE eb.election_id = $1
      ORDER BY w.ward_no NULLS FIRST, b.name
      `,
            [election_id]
        );

        res.json(result.rows);

    } catch (err) {
        console.error("Fetch election booths error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* =====================================================
   GET ALLOCATED BOOTHS BY WARD
===================================================== */
export const getElectionBoothsByWard = async (req, res) => {
    try {
        const { election_id, ward_id } = req.query;

        if (!election_id || !ward_id) {
            return res.status(400).json({
                message: "election_id and ward_id are required"
            });
        }

        const result = await pool.query(
            `
      SELECT
        eb.id AS election_booth_id,
        b.id  AS booth_id,
        b.name,
        b.latitude,
        b.longitude,
        b.radius
      FROM election_booths eb
      JOIN booths b ON b.id = eb.booth_id
      WHERE eb.election_id = $1
        AND b.ward_id = $2
      ORDER BY b.name
      `,
            [election_id, ward_id]
        );

        res.json(result.rows);

    } catch (err) {
        console.error("Fetch booths by ward error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* =====================================================
   REMOVE BOOTH FROM ELECTION (UN-ALLOCATE)
===================================================== */
export const removeBoothFromElection = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM election_booths WHERE id = $1 RETURNING id`,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Election booth not found" });
        }

        res.json({ message: "Booth removed from election" });

    } catch (err) {
        console.error("Remove booth error:", err);

        if (err.code === "23503") {
            return res.status(409).json({
                message: "Cannot remove booth. It is already in use."
            });
        }

        res.status(500).json({ message: "Server error" });
    }
};
