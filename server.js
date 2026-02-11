import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import agentRoutes from "./routes/agent.js";
import voterRoutes from "./routes/voter.js";
import masterAdminRoutes from "./routes/masteradmin.js";
import notificationRoutes from "./routes/notification.js";
import wardRoutes from "./routes/ward.js";
import electionBoothRoutes from "./routes/electionBooth.js";
import boothRoutes from "./routes/booths.js";
import candidateRoutes from "./routes/candidate.js";   // ✅ NEW
import commonRoutes from "./routes/common.js";         // ✅ NEW

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

app.options("*", (req, res) => {
  res.sendStatus(200);
});

/* =========================
   BODY PARSER
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

// 🔐 Auth
app.use("/auth", authRoutes);

// 👥 Role Based
app.use("/agent", agentRoutes);
app.use("/voter", voterRoutes);
app.use("/candidate", candidateRoutes); // ✅ NEW
app.use("/masteradmin", masterAdminRoutes);

// 🔔 Notifications
app.use("/notifications", notificationRoutes);

// 🏛 Election Core
app.use("/api/wards", wardRoutes);
app.use("/api/election-booths", electionBoothRoutes);
app.use("/api/booths", boothRoutes);

// 🌍 Shared APIs (for all roles)
app.use("/api/common", commonRoutes); // ✅ NEW

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
