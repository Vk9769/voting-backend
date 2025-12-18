import { generateToken } from "../utils/jwt.js";

// DEMO LOGIN (replace with DB later)
export const login = async (req, res) => {
  const { email, password } = req.body;

  // TEMP DEMO USERS
  const users = {
    "voter@gmail.com": { id: 1, role: "voter", password: "123456" },
    "agent@gmail.com": { id: 2, role: "agent", password: "123456" },
    "admin@gmail.com": { id: 3, role: "admin", password: "123456" }
  };

  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = generateToken({
    id: user.id,
    role: user.role,
    email
  });

  return res.json({
    token,
    role: user.role
  });
};
