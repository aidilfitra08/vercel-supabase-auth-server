import { Router } from "express";
import { getApiStatus, getHealth } from "../controllers/homeController.js";

const router = Router();

router.get("/api/status", getApiStatus);
router.get("/health", getHealth);

export default router;
