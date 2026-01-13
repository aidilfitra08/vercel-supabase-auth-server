import { Router } from "express";

const router = Router();

router.get("/api/status", (_req, res) => {
  res.json({
    status: "ok",
    service: "Auth API Server",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
