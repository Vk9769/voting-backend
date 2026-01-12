import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import masterAdminRoutes from "./routes/masteradmin.js";
import authRoutes from "./routes/auth.js";
import agentRoutes from "./routes/agent.js";
import voterRoutes from "./routes/voter.js";
import notificationRoutes from "./routes/notification.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: "*", // allow all for now
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept"
  ],
  credentials: false
}));
app.options("*", cors());

app.use(express.json());

// HEALTH CHECK (ALB)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ROOT TEST
app.get("/", (req, res) => {
  res.json({ message: "Voting API Running" });
});

//AUTH ROOT
app.use("/auth", authRoutes);

//MASTER ADMIN ROOT
app.use("/masteradmin", masterAdminRoutes);

//AGENT ROOT
app.use("/agent", agentRoutes);

//VOTER ROOT
app.use("/voter", voterRoutes);

//NOTIFICATIONS ROOT
app.use("/notifications", notificationRoutes);


const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
