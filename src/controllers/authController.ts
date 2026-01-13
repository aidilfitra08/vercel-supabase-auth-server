import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  findUserByEmail,
  insertUser,
  getUserById,
  updateUserApproval,
  getAllUsers,
} from "../db.js";
import type { RegisterRequest, LoginRequest } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export const register = async (req: Request, res: Response) => {
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
};

export const login = async (req: Request, res: Response) => {
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
};

export const getCurrentUser = async (req: Request, res: Response) => {
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
};

export const getAllUsersAdmin = async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    res.json({ users, total: users.length });
  } catch (err: any) {
    console.error("get users error", err);
    res.status(500).json({ error: "failed to fetch users" });
  }
};

export const updateUserApprovalStatus = async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({ error: "approved must be a boolean" });
    }

    const user = await updateUserApproval(userId, approved);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    res.json({
      message: `user ${approved ? "approved" : "rejected"} successfully`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        approved: user.approved,
      },
    });
  } catch (err: any) {
    console.error("update approval error", err);
    res.status(500).json({ error: "failed to update approval status" });
  }
};
