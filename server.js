import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import agentRoutes from "./routes/agent.js";
import voterRoutes from "./routes/voter.js";
import masterAdminRoutes from "./routes/masteradmin.js";
import notificationRoutes from "./routes/notification.js";

dotenv.config();

const app = express();

/* =========================
   ✅ CORS — MUST BE FIRST
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept"],
}));

// 🔥 THIS IS NON-NEGOTIABLE FOR FLUTTER WEB
app.options("*", (req, res) => {
  res.sendStatus(200);
});

/* =========================
   BODY PARSER (AFTER CORS)
========================= */
app.use(express.json());

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* =========================
   ROUTES
========================= */
app.use("/auth", authRoutes);
app.use("/agent", agentRoutes);
app.use("/voter", voterRoutes);
app.use("/masteradmin", masterAdminRoutes);
app.use("/notifications", notificationRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
