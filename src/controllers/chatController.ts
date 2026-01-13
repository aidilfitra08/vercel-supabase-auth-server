import { Request, Response } from "express";
import { LLMService, ChatMessage } from "../services/llm.js";
import { EmbeddingService } from "../services/embedding.js";
import { getQdrantService } from "../services/qdrant.js";
import { UserDetail } from "../models/userDetail.js";
import {
  validateContextArray,
  validateMessage,
  validateEmbeddingText,
  validateEmbeddingBatch,
  sendValidationErrors,
} from "../middleware/rateLimiting.js";
import {
  smartTrimConversationHistory,
  shouldCleanupHistory,
} from "../utils/conversationHistory.js";
import {
  getGlobalEmbeddingCache,
  normalizeEmbedding,
} from "../utils/embedding.js";

// Helper to get or create user details
export async function getUserDetails(userId: string) {
  let userDetail = await UserDetail.findOne({ where: { user_id: userId } });

  if (!userDetail) {
    // Create default user details
    userDetail = await UserDetail.create({
      user_id: userId,
      llm_model: "gemini",
      llm_config: {
        model: "gemini-2.5-flash",
        temperature: 0.7,
        maxTokens: 2048,
      },
      embedding_provider: process.env.EMBEDDING_PROVIDER || "gemini",
      embedding_config: {},
      preferences: {},
      personal_info: {},
      conversation_history: [],
    });
  }

  return userDetail;
}

// Helper to build system prompt from user details
function buildSystemPrompt(userDetail: any): string {
  const preferences = userDetail.preferences || {};
  const personalInfo = userDetail.personal_info || {};

  let systemPrompt =
    "You are a helpful AI assistant personalized for this user.\n\n";

  if (Object.keys(personalInfo).length > 0) {
    systemPrompt += "User Information:\n";
    for (const [key, value] of Object.entries(personalInfo)) {
      systemPrompt += `- ${key}: ${value}\n`;
    }
    systemPrompt += "\n";
  }

  if (Object.keys(preferences).length > 0) {
    systemPrompt += "User Preferences:\n";
    for (const [key, value] of Object.entries(preferences)) {
      systemPrompt += `- ${key}: ${value}\n`;
    }
    systemPrompt += "\n";
  }

  return systemPrompt;
}

export const chatStream = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      message,
      context,
      auto_retrieve = true,
      retrieve_limit = 3,
    } = req.body;

    // Validate inputs
    const messageErrors = validateMessage(message);
    if (messageErrors.length > 0) {
      return sendValidationErrors(res, messageErrors);
    }

    const contextErrors = validateContextArray(context);
    if (contextErrors.length > 0) {
      return sendValidationErrors(res, contextErrors);
    }

    // Get user details and LLM configuration
    const userDetail = await getUserDetails(user.id);
    const llmConfigData = userDetail.get("llm_config") as any;
    const llmConfig = {
      provider: userDetail.get("llm_model") as any,
      ...(typeof llmConfigData === "object" && llmConfigData !== null
        ? llmConfigData
        : {}),
    };

    // Initialize LLM service
    const llmService = new LLMService(llmConfig);

    // Build messages array
    const messages: ChatMessage[] = [];

    // Add system prompt
    const systemPrompt = buildSystemPrompt(userDetail);
    messages.push({ role: "system", content: systemPrompt });

    // Add conversation history with smart trimming for context optimization
    let history = (userDetail.get("conversation_history") as any[]) || [];

    // Check if history needs cleanup (proactive management)
    if (shouldCleanupHistory(history)) {
      history = smartTrimConversationHistory(history);
      console.log(`[CLEANUP] Trimmed history for user ${user.id}`);
    }

    const recentHistory = history.slice(-10);
    messages.push(...recentHistory);

    // Auto-retrieve relevant documents from Qdrant
    let retrievedDocs: string[] = [];
    if (auto_retrieve) {
      try {
        const qdrant = getQdrantService();
        const results = await qdrant.searchByUser(
          message,
          user.id,
          retrieve_limit
        );
        retrievedDocs = results.map((r) => r.text);

        if (retrievedDocs.length > 0) {
          console.log(
            `[RAG] Retrieved ${retrievedDocs.length} documents for user ${user.id}`
          );
        }
      } catch (error: any) {
        console.warn(`[RAG] Failed to retrieve documents: ${error.message}`);
        // Continue without RAG if Qdrant fails
      }
    }

    // Add RAG context (manual + auto-retrieved)
    const allContext = [...(context || []), ...retrievedDocs];
    if (allContext.length > 0) {
      const contextText = allContext.join("\n\n");
      messages.push({
        role: "system",
        content: `Relevant context:\n${contextText}`,
      });
    }

    // Add user message
    messages.push({ role: "user", content: message });

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx

    // Stream response
    let fullResponse = "";

    try {
      // Debug mode - stream random text instead of actual LLM response
      if (process.env.STREAM_DEBUG_MODE === "true") {
        const debugTexts = [
          "This is a debug response. ",
          "Streaming is working correctly. ",
          "The SSE connection is established. ",
          "Each chunk appears with a small delay. ",
          "You can test the frontend streaming UI with this. ",
          "Debug mode is enabled via STREAM_DEBUG_MODE env variable. ",
          "This helps you verify the streaming functionality. ",
          "No actual LLM API calls are made in debug mode. ",
          "Perfect for development and testing! ",
        ];

        for (const text of debugTexts) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          // Add a small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        console.log(`[DEBUG] Streamed debug response for user ${user.id}`);
      } else {
        // Normal mode - use actual LLM
        for await (const chunk of llmService.chatStream(messages)) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      // Update conversation history with trimming
      let updatedHistory = [
        ...recentHistory,
        {
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: fullResponse,
          timestamp: new Date().toISOString(),
        },
      ];

      // Apply smart trimming before saving
      updatedHistory = smartTrimConversationHistory(updatedHistory);

      await UserDetail.update(
        { conversation_history: updatedHistory },
        { where: { user_id: user.id } }
      );
    } catch (streamError: any) {
      console.error("Streaming error:", streamError);
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error("Chat stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "chat stream failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};

export const chat = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      message,
      context,
      auto_retrieve = true,
      retrieve_limit = 3,
    } = req.body;

    // Validate inputs
    const messageErrors = validateMessage(message);
    if (messageErrors.length > 0) {
      return sendValidationErrors(res, messageErrors);
    }

    const contextErrors = validateContextArray(context);
    if (contextErrors.length > 0) {
      return sendValidationErrors(res, contextErrors);
    }

    // Get user details and LLM configuration
    const userDetail = await getUserDetails(user.id);
    const llmConfigData = userDetail.get("llm_config") as any;
    const llmConfig = {
      provider: userDetail.get("llm_model") as any,
      ...(typeof llmConfigData === "object" && llmConfigData !== null
        ? llmConfigData
        : {}),
    };

    // Initialize LLM service
    const llmService = new LLMService(llmConfig);

    // Build messages array
    const messages: ChatMessage[] = [];

    // Add system prompt
    const systemPrompt = buildSystemPrompt(userDetail);
    messages.push({ role: "system", content: systemPrompt });

    // Add conversation history with smart trimming
    let history = (userDetail.get("conversation_history") as any[]) || [];

    // Check if history needs cleanup
    if (shouldCleanupHistory(history)) {
      history = smartTrimConversationHistory(history);
      console.log(`[CLEANUP] Trimmed history for user ${user.id}`);
    }

    const recentHistory = history.slice(-10);
    messages.push(...recentHistory);

    // Auto-retrieve relevant documents from Qdrant
    let retrievedDocs: string[] = [];
    if (auto_retrieve) {
      try {
        const qdrant = getQdrantService();
        const results = await qdrant.searchByUser(
          message,
          user.id,
          retrieve_limit
        );
        retrievedDocs = results.map((r) => r.text);

        if (retrievedDocs.length > 0) {
          console.log(
            `[RAG] Retrieved ${retrievedDocs.length} documents for user ${user.id}`
          );
        }
      } catch (error: any) {
        console.warn(`[RAG] Failed to retrieve documents: ${error.message}`);
        // Continue without RAG if Qdrant fails
      }
    }

    // Add RAG context (manual + auto-retrieved)
    const allContext = [...(context || []), ...retrievedDocs];
    if (allContext.length > 0) {
      const contextText = allContext.join("\n\n");
      messages.push({
        role: "system",
        content: `Relevant context:\n${contextText}`,
      });
    }

    // Add user message
    messages.push({ role: "user", content: message });

    // Get response
    let response: string;

    // Debug mode - return mock response instead of actual LLM response
    if (process.env.STREAM_DEBUG_MODE === "true") {
      response =
        "This is a debug response. The chat endpoint is working correctly. " +
        "Debug mode is enabled via STREAM_DEBUG_MODE env variable. " +
        "No actual LLM API calls are made in debug mode. " +
        "Perfect for development and testing!";
      console.log(`[DEBUG] Returned debug response for user ${user.id}`);
    } else {
      // Normal mode - use actual LLM
      response = await llmService.chat(messages);
    }

    // Update conversation history with trimming
    let updatedHistory = [
      ...recentHistory,
      { role: "user", content: message, timestamp: new Date().toISOString() },
      {
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      },
    ];

    // Apply smart trimming before saving
    updatedHistory = smartTrimConversationHistory(updatedHistory);

    await UserDetail.update(
      { conversation_history: updatedHistory },
      { where: { user_id: user.id } }
    );

    res.json({ response, message });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "chat failed" });
  }
};

export const generateEmbedding = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { text, texts, use_cache } = req.body;

    // Validate inputs
    if (text) {
      const textErrors = validateEmbeddingText(text);
      if (textErrors.length > 0) {
        return sendValidationErrors(res, textErrors);
      }
    } else if (texts) {
      const batchErrors = validateEmbeddingBatch(texts);
      if (batchErrors.length > 0) {
        return sendValidationErrors(res, batchErrors);
      }
    } else {
      return res.status(400).json({ error: "text or texts array is required" });
    }

    // Get user details and embedding configuration
    const userDetail = await getUserDetails(user.id);
    const embeddingConfigData = userDetail.get("embedding_config") as any;
    const embeddingConfig = {
      provider: userDetail.get("embedding_provider") as any,
      ...(typeof embeddingConfigData === "object" &&
      embeddingConfigData !== null
        ? embeddingConfigData
        : {}),
    };

    // Initialize embedding service
    const embeddingService = new EmbeddingService(embeddingConfig);

    // Get embedding cache
    const cache = use_cache !== false ? getGlobalEmbeddingCache() : null;

    if (text) {
      // Single embedding - check cache first
      let embedding = cache?.get(text) || null;

      if (!embedding) {
        embedding = await embeddingService.embed(text);

        // Normalize and cache
        embedding = normalizeEmbedding(embedding);
        cache?.set(text, embedding);
      }

      res.json({ embedding });
    } else {
      // Batch embeddings - check cache for each
      const embeddings = [];

      for (const t of texts) {
        let emb = cache?.get(t) || null;

        if (!emb) {
          emb = await embeddingService.embed(t);
          emb = normalizeEmbedding(emb);
          cache?.set(t, emb);
        }

        embeddings.push(emb);
      }

      // Optional: return similarity matrix for batch
      res.json({
        embeddings,
        count: embeddings.length,
        cached: use_cache !== false,
      });
    }
  } catch (error: any) {
    console.error("Embedding error:", error);
    res.status(500).json({ error: error.message || "embedding failed" });
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userDetail = await getUserDetails(user.id);

    res.json({
      llm_model: userDetail.get("llm_model"),
      llm_config: userDetail.get("llm_config"),
      embedding_provider: userDetail.get("embedding_provider"),
      embedding_config: userDetail.get("embedding_config"),
      preferences: userDetail.get("preferences"),
      personal_info: userDetail.get("personal_info"),
    });
  } catch (error: any) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: error.message || "failed to get settings" });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      llm_model,
      llm_config,
      embedding_provider,
      embedding_config,
      preferences,
      personal_info,
    } = req.body;

    const userDetail = await getUserDetails(user.id);

    const updates: any = {};
    if (llm_model !== undefined) updates.llm_model = llm_model;
    if (llm_config !== undefined) updates.llm_config = llm_config;
    if (embedding_provider !== undefined)
      updates.embedding_provider = embedding_provider;
    if (embedding_config !== undefined)
      updates.embedding_config = embedding_config;
    if (preferences !== undefined) updates.preferences = preferences;
    if (personal_info !== undefined) updates.personal_info = personal_info;

    await UserDetail.update(updates, { where: { user_id: user.id } });

    res.json({ message: "settings updated successfully" });
  } catch (error: any) {
    console.error("Update settings error:", error);
    res
      .status(500)
      .json({ error: error.message || "failed to update settings" });
  }
};

export const clearHistory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    await UserDetail.update(
      { conversation_history: [] },
      { where: { user_id: user.id } }
    );

    res.json({ message: "conversation history cleared" });
  } catch (error: any) {
    console.error("Clear history error:", error);
    res.status(500).json({ error: error.message || "failed to clear history" });
  }
};
