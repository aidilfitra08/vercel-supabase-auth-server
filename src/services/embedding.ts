import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

export type EmbeddingProvider = "gemini" | "fastapi";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey?: string;
  fastapiUrl?: string;
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
}

export class EmbeddingService {
  private config: EmbeddingConfig;
  private geminiClient?: GoogleGenerativeAI;

  constructor(config: EmbeddingConfig) {
    this.config = config;
    this.initializeClient();
  }

  private initializeClient() {
    if (this.config.provider === "gemini") {
      const geminiKey = this.config.apiKey || process.env.GEMINI_API_KEY || "";
      if (!geminiKey) {
        throw new Error("Gemini API key is required for embeddings");
      }
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
  }

  async embed(text: string): Promise<number[]> {
    switch (this.config.provider) {
      case "gemini":
        return this.embedWithGemini(text);
      case "fastapi":
        return this.embedWithFastAPI(text);
      default:
        throw new Error(
          `Unsupported embedding provider: ${this.config.provider}`
        );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    switch (this.config.provider) {
      case "gemini":
        return this.embedBatchWithGemini(texts);
      case "fastapi":
        return this.embedBatchWithFastAPI(texts);
      default:
        throw new Error(
          `Unsupported embedding provider: ${this.config.provider}`
        );
    }
  }

  private async embedWithGemini(text: string): Promise<number[]> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized");
    }

    const modelName = this.config.model || "gemini-embedding-001";
    const model = this.geminiClient.getGenerativeModel({ model: modelName });

    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  private async embedBatchWithGemini(texts: string[]): Promise<number[][]> {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized");
    }

    const modelName = this.config.model || "embedding-001";
    const model = this.geminiClient.getGenerativeModel({ model: modelName });

    // For batch embeddings, we'll do them individually since the API structure is complex
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      })
    );

    return embeddings;
  }

  private async embedWithFastAPI(text: string): Promise<number[]> {
    const url = this.config.fastapiUrl || process.env.FASTAPI_EMBEDDING_URL;
    if (!url) {
      throw new Error("FastAPI embedding URL is required");
    }

    try {
      const response = await axios.post(`${url}/embed`, {
        text,
        model: this.config.model || "default",
      });

      if (!response.data || !response.data.embedding) {
        throw new Error("Invalid response from FastAPI embedding service");
      }

      return response.data.embedding;
    } catch (error: any) {
      console.error("FastAPI embedding error:", error.message);
      throw new Error(`FastAPI embedding failed: ${error.message}`);
    }
  }

  private async embedBatchWithFastAPI(texts: string[]): Promise<number[][]> {
    const url = this.config.fastapiUrl || process.env.FASTAPI_EMBEDDING_URL;
    if (!url) {
      throw new Error("FastAPI embedding URL is required");
    }

    try {
      const response = await axios.post(`${url}/embed_batch`, {
        texts,
        model: this.config.model || "default",
      });

      if (!response.data || !response.data.embeddings) {
        throw new Error("Invalid response from FastAPI embedding service");
      }

      return response.data.embeddings;
    } catch (error: any) {
      console.error("FastAPI batch embedding error:", error.message);
      throw new Error(`FastAPI batch embedding failed: ${error.message}`);
    }
  }

  // Helper method for similarity search
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
