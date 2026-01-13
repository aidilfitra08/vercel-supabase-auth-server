//@ts-nocheck

/**
 * Example: Using Best Practices in Your Code
 *
 * This file shows how to leverage the built-in best practices
 * in your application.
 */

// ============================================================================
// 1. RATE LIMITING EXAMPLE
// ============================================================================

import { Router } from "express";
import {
  chatLimiter,
  authLimiter,
  validateMessage,
} from "./middleware/rateLimiting.js";

const router = Router();

// Apply rate limiting to your routes
router.post("/chat", chatLimiter, async (req, res) => {
  // This route will only allow 30 requests per 15 minutes per user
  const { message } = req.body;

  // Handle request...
});

// ============================================================================
// 2. INPUT VALIDATION EXAMPLE
// ============================================================================

import {
  validateMessage,
  validateContextArray,
  sendValidationErrors,
} from "./middleware/rateLimiting.js";

router.post("/api/process", async (req, res) => {
  const { message, context } = req.body;

  // Validate message
  const messageErrors = validateMessage(message);
  if (messageErrors.length > 0) {
    return sendValidationErrors(res, messageErrors);
  }

  // Validate context
  const contextErrors = validateContextArray(context);
  if (contextErrors.length > 0) {
    return sendValidationErrors(res, contextErrors);
  }

  // All validations passed, proceed with request
  console.log("Valid input received");
  res.json({ success: true });
});

// ============================================================================
// 3. CONVERSATION HISTORY MANAGEMENT EXAMPLE
// ============================================================================

import {
  smartTrimConversationHistory,
  shouldCleanupHistory,
  estimateTokens,
} from "./utils/conversationHistory.js";

async function handleChatRequest(userId, message, userDetail) {
  // Get current conversation history
  let history = userDetail.conversation_history || [];

  // Check if cleanup is needed (proactive management)
  if (shouldCleanupHistory(history)) {
    console.log(`[CLEANUP] Trimming history for user ${userId}`);
    history = smartTrimConversationHistory(history);
  }

  // Get last 10 messages for context
  const recentHistory = history.slice(-10);

  // Build messages for LLM
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    ...recentHistory,
    { role: "user", content: message },
  ];

  // Get response from LLM
  const response = "LLM response here";

  // Add new messages to history with timestamps
  let updatedHistory = [
    ...recentHistory,
    {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    },
    {
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
    },
  ];

  // Trim before saving to ensure token limits
  updatedHistory = smartTrimConversationHistory(updatedHistory);

  // Save trimmed history
  await userDetail.update({ conversation_history: updatedHistory });

  return response;
}

// ============================================================================
// 4. EMBEDDING CACHING EXAMPLE
// ============================================================================

import {
  getGlobalEmbeddingCache,
  normalizeEmbedding,
  cosineSimilarity,
  findSimilarEmbeddings,
} from "./utils/embedding.js";

async function embeddingWithCache(text, embeddingService) {
  const cache = getGlobalEmbeddingCache();

  // Check cache first
  let embedding = cache.get(text);

  if (!embedding) {
    // Not in cache, compute it
    embedding = await embeddingService.embed(text);

    // Normalize for cosine similarity
    embedding = normalizeEmbedding(embedding);

    // Store in cache for future use
    cache.set(text, embedding);

    console.log("Embedding computed and cached");
  } else {
    console.log("Embedding retrieved from cache");
  }

  return embedding;
}

// Find similar documents (RAG)
async function findSimilarDocuments(query, documents, embeddingService) {
  const cache = getGlobalEmbeddingCache();

  // Get query embedding
  const queryEmbedding = await embeddingWithCache(query, embeddingService);

  // Get embeddings for all documents (with caching)
  const docEmbeddings = await Promise.all(
    documents.map(async (doc) => ({
      text: doc,
      embedding: await embeddingWithCache(doc, embeddingService),
    }))
  );

  // Find top 5 similar documents
  const similar = findSimilarEmbeddings(queryEmbedding, docEmbeddings, 5);

  return similar;
}

// ============================================================================
// 5. COMPLETE EXAMPLE: PRODUCTION-READY CHAT ENDPOINT
// ============================================================================

import {
  chatLimiter,
  validateMessage,
  validateContextArray,
  sendValidationErrors,
} from "./middleware/rateLimiting.js";
import {
  smartTrimConversationHistory,
  shouldCleanupHistory,
} from "./utils/conversationHistory.js";
import {
  getGlobalEmbeddingCache,
  normalizeEmbedding,
} from "./utils/embedding.js";
import ts from "typescript";

router.post(
  "/production/chat",
  chatLimiter, // Apply rate limiting
  async (req, res) => {
    try {
      const user = req.user; // From auth middleware
      const { message, context } = req.body;

      // ========== STEP 1: INPUT VALIDATION ==========
      const messageErrors = validateMessage(message);
      if (messageErrors.length > 0) {
        return sendValidationErrors(res, messageErrors);
      }

      const contextErrors = validateContextArray(context);
      if (contextErrors.length > 0) {
        return sendValidationErrors(res, contextErrors);
      }

      // ========== STEP 2: LOAD USER CONTEXT ==========
      const userDetail = await getUserDetails(user.id);
      let history = userDetail.conversation_history || [];

      // ========== STEP 3: PROACTIVE HISTORY CLEANUP ==========
      if (shouldCleanupHistory(history)) {
        history = smartTrimConversationHistory(history);
        console.log(`[CLEANUP] Trimmed history for user ${user.id}`);
      }

      // ========== STEP 4: BUILD MESSAGES FOR LLM ==========
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        ...history.slice(-10), // Keep last 10 for context
      ];

      if (context?.length > 0) {
        messages.push({
          role: "system",
          content: `Relevant context:\n${context.join("\n\n")}`,
        });
      }

      messages.push({ role: "user", content: message });

      // ========== STEP 5: GET LLM RESPONSE ==========
      const response = "Response from LLM";

      // ========== STEP 6: UPDATE HISTORY WITH TRIMMING ==========
      let updatedHistory = [
        ...history.slice(-10),
        { role: "user", content: message, timestamp: new Date().toISOString() },
        {
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString(),
        },
      ];

      // Apply smart trimming before saving
      updatedHistory = smartTrimConversationHistory(updatedHistory);

      // Save to database
      await userDetail.update({ conversation_history: updatedHistory });

      // ========== STEP 7: SEND RESPONSE ==========
      res.json({ response, message });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message || "chat failed" });
    }
  }
);

// ============================================================================
// 6. MONITORING & DEBUGGING EXAMPLE
// ============================================================================

async function monitorSystemHealth() {
  const cache = getGlobalEmbeddingCache();
  const stats = cache.getStats();

  console.log("=== Cache Statistics ===");
  console.log(`Size: ${stats.size}/${stats.maxSize}`);
  console.log(`Utilization: ${stats.utilization}`);

  // Reset if needed
  if (stats.size > 900) {
    console.log("Cache approaching capacity, clearing...");
    cache.clear();
  }
}

// Run periodically
setInterval(monitorSystemHealth, 60000); // Every minute

// ============================================================================
// 7. ERROR HANDLING EXAMPLE
// ============================================================================

async function robustEmbedding(text, embeddingService) {
  const cache = getGlobalEmbeddingCache();

  try {
    // Check cache
    let embedding = cache.get(text);
    if (embedding) return embedding;

    // Compute embedding
    embedding = await embeddingService.embed(text);

    // Validate result
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Invalid embedding result");
    }

    // Normalize and cache
    embedding = normalizeEmbedding(embedding);
    cache.set(text, embedding);

    return embedding;
  } catch (error) {
    console.error(`Failed to embed text: ${error.message}`);

    // Return zero embedding as fallback
    return new Array(768).fill(0); // Assuming 768-dim embeddings
  }
}

// ============================================================================
// 8. TESTING EXAMPLE
// ============================================================================

async function testBestPractices() {
  // Test validation
  const validResult = validateMessage("Hello world");
  console.assert(
    validResult.length === 0,
    "Valid message should have no errors"
  );

  const invalidResult = validateMessage("a".repeat(10001));
  console.assert(
    invalidResult.length > 0,
    "Too long message should have errors"
  );

  // Test history trimming
  const history = Array(50)
    .fill(null)
    .map((_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    }));

  const trimmed = smartTrimConversationHistory(history);
  console.assert(
    trimmed.length <= 20,
    "Trimmed history should have <= 20 messages"
  );

  // Test caching
  const cache = getGlobalEmbeddingCache();
  const embedding1 = [1, 2, 3, 4, 5];
  cache.set("test", embedding1);
  const embedding2 = cache.get("test");
  console.assert(
    JSON.stringify(embedding1) === JSON.stringify(embedding2),
    "Cache should return same value"
  );

  console.log("✅ All tests passed!");
}

// Run tests
// testBestPractices();

export default router;
