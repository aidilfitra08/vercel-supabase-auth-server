import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { findUserByEmail, insertUser, getUserById } from "../db.js";
import type { RegisterRequest, LoginRequest } from "../types.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body as RegisterRequest;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "user already exists" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const created = await insertUser({ email, name, password_hash });
    res
      .status(201)
      .json({ message: "registered, pending approval", userId: created.id });
  } catch (err: any) {
    console.error("register error", err);
    res.status(500).json({ error: "registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as LoginRequest;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    if (!user.approved) {
      return res
        .status(200)
        .json({ approved: false, message: "pending approval" });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, approved: true },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    res.json({ token, approved: true });
  } catch (err: any) {
    console.error("login error", err);
    res.status(500).json({ error: "login failed" });
  }
});

router.get("/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      email: string;
      approved: boolean;
    };
    const user = await getUserById(payload.sub);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      approved: user.approved,
    });
  } catch (err: any) {
    return res.status(401).json({ error: "invalid token" });
  }
});

export default router;
