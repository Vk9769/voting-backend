import { pool } from "../services/db.js";
import { sendPush } from "../services/fcm.js";

/* =========================
   CREATE NOTIFICATION
========================= */
export const createNotification = async (
  userId,
  title,
  message,
  type
) => {
  // 1️⃣ Save in DB
  await pool.query(
    `
    INSERT INTO notifications (user_id, title, message, type)
    VALUES ($1, $2, $3, $4)
    `,
    [userId, title, message, type]
  );

  // 2️⃣ Get FCM tokens
  const { rows } = await pool.query(
    `SELECT token FROM fcm_tokens WHERE user_id = $1`,
    [userId]
  );

  const tokens = rows.map(r => r.token);

  // 3️⃣ Send push
  await sendPush(tokens, title, message);
};

/* =========================
   GET USER NOTIFICATIONS
========================= */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Notification fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   MARK AS READ
========================= */
export const markAsRead = async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    `,
    [id, userId]
  );

  res.json({ message: "Marked as read" });
};

/* =========================
   DELETE NOTIFICATIONS
========================= */
export const deleteNotifications = async (req, res) => {
  const userId = req.user.userId;
  const { ids } = req.body; // array

  await pool.query(
    `
    DELETE FROM notifications
    WHERE user_id = $1 AND id = ANY($2)
    `,
    [userId, ids]
  );

  res.json({ message: "Deleted" });
};

/* =========================
   UNREAD NOTIFICATIONS COUNTS
========================= */

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
      `,
      [userId]
    );

    res.json({ unread: result.rows[0].count });
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
  SAVE FCM TOKEN
========================= */
export const saveFcmToken = async (req, res) => {
  const userId = req.user.userId;
  const { token, platform } = req.body;

  await pool.query(
    `
    INSERT INTO fcm_tokens (user_id, token, platform)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, token) DO NOTHING
    `,
    [userId, token, platform]
  );

  res.json({ message: "FCM token saved" });
};
