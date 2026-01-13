import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUserById } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "admin-key-change-me";

// Middleware to verify JWT and attach user
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      email: string;
      approved: boolean;
    };

    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    if (!user.approved) {
      return res.status(403).json({ error: "user not approved" });
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "invalid token" });
  }
};

// Middleware to verify admin API key
export const verifyAdminAccess = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers["x-api-key"] || req.headers["api-key"];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res
      .status(403)
      .json({ error: "forbidden: invalid or missing API key" });
  }
  next();
};
