import { Request, Response } from "express";
import rateLimit from "express-rate-limit";

/**
 * Rate limiting middleware configurations
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for admin requests (they have API key)
    return !!req.headers["x-api-key"];
  },
});

// Auth endpoints rate limiter - strict (5 attempts per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login/register attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by email if provided, otherwise by IP
    const email = (req.body as any)?.email || req.ip || "";
    return `${req.path}:${email}`;
  },
});

// Chat endpoints rate limiter - moderate (30 requests per 15 minutes per user)
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many chat requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID from token
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return `chat:${token || req.ip}`;
  },
});

// Embedding endpoints rate limiter - moderate (50 requests per 15 minutes per user)
export const embeddingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many embedding requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    return `embed:${token || req.ip}`;
  },
});

/**
 * Input validation helpers
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate chat context array
 * Max 10 items recommended to avoid token limits
 */
export function validateContextArray(context: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(context)) {
    errors.push({ field: "context", message: "context must be an array" });
    return errors;
  }

  if (context.length > 10) {
    errors.push({
      field: "context",
      message: `context array too large (max 10 items, got ${context.length})`,
    });
  }

  context.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push({
        field: `context[${index}]`,
        message: "each context item must be a string",
      });
    }

    if (item.length > 5000) {
      errors.push({
        field: `context[${index}]`,
        message: `context item too large (max 5000 chars, got ${item.length})`,
      });
    }
  });

  return errors;
}

/**
 * Validate message length
 */
export function validateMessage(message: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof message !== "string") {
    errors.push({ field: "message", message: "message must be a string" });
    return errors;
  }

  if (message.trim().length === 0) {
    errors.push({ field: "message", message: "message cannot be empty" });
  }

  if (message.length > 10000) {
    errors.push({
      field: "message",
      message: `message too long (max 10000 chars, got ${message.length})`,
    });
  }

  return errors;
}

/**
 * Validate text for embedding
 */
export function validateEmbeddingText(text: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof text !== "string") {
    errors.push({ field: "text", message: "text must be a string" });
    return errors;
  }

  if (text.trim().length === 0) {
    errors.push({ field: "text", message: "text cannot be empty" });
  }

  if (text.length > 10000) {
    errors.push({
      field: "text",
      message: `text too long (max 10000 chars, got ${text.length})`,
    });
  }

  return errors;
}

/**
 * Validate batch embedding texts
 */
export function validateEmbeddingBatch(texts: any[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Array.isArray(texts)) {
    errors.push({ field: "texts", message: "texts must be an array" });
    return errors;
  }

  if (texts.length === 0) {
    errors.push({ field: "texts", message: "texts array cannot be empty" });
  }

  if (texts.length > 100) {
    errors.push({
      field: "texts",
      message: `too many texts (max 100, got ${texts.length})`,
    });
  }

  texts.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push({
        field: `texts[${index}]`,
        message: "each text must be a string",
      });
    }

    if (item.length > 10000) {
      errors.push({
        field: `texts[${index}]`,
        message: `text too long (max 10000 chars, got ${item.length})`,
      });
    }
  });

  return errors;
}

/**
 * Send validation errors response
 */
export function sendValidationErrors(res: Response, errors: ValidationError[]) {
  res.status(400).json({
    error: "validation failed",
    details: errors,
  });
}
