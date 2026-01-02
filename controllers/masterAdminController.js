import { pool } from "../services/db.js";

export const getAllBoothsHierarchy = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        state,
        district,
        ac_name_no   AS assembly_constituency,
        part_name_no AS part_name,
        COUNT(*)     AS booths
      FROM booths
      GROUP BY state, district, ac_name_no, part_name_no
      ORDER BY state, district, ac_name_no, part_name_no
    `);

    res.json(rows);
  } catch (err) {
    console.error("MasterAdmin booths error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
