import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- HEALTH CHECK (VERY IMPORTANT FOR ALB + ECS) ---
app.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok" });
});

// --- SIMPLE TEST ROUTE ---
app.get("/", (req, res) => {
  return res.status(200).json({ message: "Voting API Running" });
});

// LOAD ROUTES
import adminRoutes from "./routes/admin.js";
import voterRoutes from "./routes/voter.js";
import authRoutes from "./routes/auth.js";

app.use("/admin", adminRoutes);
app.use("/voter", voterRoutes);
app.use("/auth", authRoutes);

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("API running at port", PORT);
});
