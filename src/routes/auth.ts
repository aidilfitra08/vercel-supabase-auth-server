import { Router } from "express";
import { authLimiter, apiLimiter } from "../middleware/rateLimiting.js";
import { verifyAdminAccess } from "../middleware/auth.js";
import {
  register,
  login,
  getCurrentUser,
  getAllUsersAdmin,
  updateUserApprovalStatus,
} from "../controllers/authController.js";

const router = Router();

// Authentication endpoints
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", getCurrentUser);

// Admin endpoints
router.get("/admin/users", apiLimiter, verifyAdminAccess, getAllUsersAdmin);
router.patch(
  "/admin/users/:userId/approval",
  apiLimiter,
  verifyAdminAccess,
  updateUserApprovalStatus
);

export default router;
