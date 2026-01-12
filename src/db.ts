import dotenv from "dotenv";
import type { UserRecord } from "./types";
import { initDb } from "./sequelize.js";
import { User } from "./models/user.js";

dotenv.config();

function mapUser(model: any): UserRecord {
  const plain = model.get({ plain: true }) as {
    id: string;
    email: string;
    name: string | null;
    password_hash: string;
    approved: boolean;
    created_at: Date | null;
  };
  return {
    ...plain,
    created_at: plain.created_at ? plain.created_at.toISOString() : "",
  };
}

export async function ensureDb() {
  await initDb();
}

export async function findUserByEmail(
  email: string
): Promise<UserRecord | null> {
  const user = await User.findOne({ where: { email } });
  if (!user) return null;
  return mapUser(user);
}

export async function insertUser(user: {
  email: string;
  name?: string | null;
  password_hash: string;
}): Promise<UserRecord> {
  const created = await User.create({
    email: user.email,
    name: user.name ?? null,
    password_hash: user.password_hash,
    approved: false,
  });
  return mapUser(created);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const user = await User.findByPk(id);
  if (!user) return null;
  return mapUser(user);
}
