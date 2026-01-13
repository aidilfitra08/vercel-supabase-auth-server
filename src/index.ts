import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDb } from "./db.js";
import homeRoutes from "./routes/home.js";
import authRoutes from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
await ensureDb();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

// Routes
app.use("/", homeRoutes);
app.use("/", authRoutes);

// Static files (after routes)
app.use(express.static(path.join(__dirname, "../public")));

app.listen(port, () => {
  console.log(`Auth server listening on :${port}`);
});
