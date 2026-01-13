import { Router } from "express";
import { apiLimiter } from "../middleware/rateLimiting.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  storeDocument,
  storeBatchDocuments,
  searchDocuments,
  getDocumentById,
  listDocuments,
  deleteDocument,
  deleteAllUserDocuments,
  checkQdrantHealth,
} from "../controllers/documentsController.js";

const router = Router();

// Document management endpoints
router.post("/", apiLimiter, authenticateUser, storeDocument);
router.post("/batch", apiLimiter, authenticateUser, storeBatchDocuments);
router.post("/search", apiLimiter, authenticateUser, searchDocuments);
router.get("/", apiLimiter, authenticateUser, listDocuments);
router.get("/:id", apiLimiter, authenticateUser, getDocumentById);
router.delete("/:id", apiLimiter, authenticateUser, deleteDocument);
router.delete("/", apiLimiter, authenticateUser, deleteAllUserDocuments);

// Health check endpoint
router.get("/health", checkQdrantHealth);

export default router;
