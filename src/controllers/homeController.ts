import { Request, Response } from "express";

export const getApiStatus = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Auth API Server",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const getHealth = (_req: Request, res: Response) => {
  res.json({ status: "ok" });
};
