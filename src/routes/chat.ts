import { Router } from "express";
import { chatLimiter, embeddingLimiter } from "../middleware/rateLimiting.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  chatStream,
  chat,
  generateEmbedding,
  getSettings,
  updateSettings,
  clearHistory,
} from "../controllers/chatController.js";

const router = Router();

// Chat endpoints
router.post("/chat/stream", chatLimiter, authenticateUser, chatStream);
router.post("/chat", chatLimiter, authenticateUser, chat);

// Embedding endpoints
router.post("/embed", embeddingLimiter, authenticateUser, generateEmbedding);

// Settings endpoints
router.get("/settings", authenticateUser, getSettings);
router.put("/settings", authenticateUser, updateSettings);

// History endpoints
router.delete("/history", authenticateUser, clearHistory);

export default router;
