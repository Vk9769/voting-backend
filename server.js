import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ROOT TEST
app.get("/", (req, res) => {
  res.json({ message: "Voting API Running" });
});

// ❌ COMMENT OUT ROUTES TEMPORARILY
// import adminRoutes from "./routes/admin.js";
// import voterRoutes from "./routes/voter.js";
// import authRoutes from "./routes/auth.js";

// app.use("/admin", adminRoutes);
// app.use("/voter", voterRoutes);
// app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
