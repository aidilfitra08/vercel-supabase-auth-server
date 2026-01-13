import dotenv from "dotenv";
import pg from "pg";
import { Sequelize } from "sequelize";

dotenv.config();

let sequelize: Sequelize | null = null;

function buildSequelize(): Sequelize {
  const dbUrl = process.env.DB_URL;
  const dbType = (process.env.DB_TYPE || "supabase").toLowerCase();

  if (dbUrl) {
    return new Sequelize(dbUrl, {
      dialect: "postgres",
      logging: false,
      dialectModule: pg,
      dialectOptions: {
        ssl:
          process.env.DB_SSL === "false"
            ? false
            : { require: true, rejectUnauthorized: false },
      },
    });
  }

  const isSupabase = dbType === "supabase";

  const host = isSupabase ? process.env.SUPABASE_DB_HOST : process.env.DB_HOST;
  const port = Number(
    isSupabase
      ? process.env.SUPABASE_DB_PORT || 5432
      : process.env.DB_PORT || 5432
  );
  const database = isSupabase
    ? process.env.SUPABASE_DB_NAME
    : process.env.DB_NAME;
  const username = isSupabase
    ? process.env.SUPABASE_DB_USER
    : process.env.DB_USER;
  const password = isSupabase
    ? process.env.SUPABASE_DB_PASSWORD
    : process.env.DB_PASSWORD;

  return new Sequelize(database || "", username || "", password || "", {
    host,
    port,
    dialect: "postgres",
    logging: false,
    dialectModule: pg,
    dialectOptions: {
      ssl: isSupabase ? { require: true, rejectUnauthorized: false } : false,
    },
  });
}

export function getSequelize(): Sequelize {
  if (!sequelize) {
    sequelize = buildSequelize();
  }
  return sequelize;
}

export async function initDb() {
  try {
    const db = getSequelize();
    await db.authenticate();
    await db.sync({ alter: true });
    console.log("Database synchronized");
  } catch (error: any) {
    if (process.env.VERCEL === "1") {
      console.warn("Database initialization skipped on Vercel:", error.message);
      return;
    }
    throw error;
  }
}
