import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// HEALTH CHECK (ALB)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ROOT TEST
app.get("/", (req, res) => {
  res.json({ message: "Voting API Running" });
});

// 🚫 NO ROUTES, NO SERVICES, NO REDIS, NO DB

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
