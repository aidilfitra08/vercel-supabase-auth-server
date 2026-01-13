import { QdrantClient } from "@qdrant/qdrant-js";
import { EmbeddingService } from "./embedding.js";

/**
 * Qdrant Vector Database Service
 * Handles document storage, retrieval, and semantic search
 */

export interface DocumentMetadata {
  user_id?: string;
  doc_type?: string;
  source?: string;
  created_at?: string;
  [key: string]: any;
}

export interface SearchResult {
  id: string | number;
  score: number;
  text: string;
  metadata: DocumentMetadata;
}

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;
  private embeddingService: EmbeddingService;
  private vectorSize: number;

  constructor(config: {
    url?: string;
    apiKey?: string;
    collectionName?: string;
    embeddingProvider?: string;
    embeddingConfig?: any;
    vectorSize?: number;
  }) {
    // Auto-detect cloud vs local
    const url = config.url || process.env.QDRANT_URL || "http://localhost:6333";
    const apiKey = config.apiKey || process.env.QDRANT_API_KEY;

    // Initialize Qdrant client
    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
    });

    this.collectionName =
      config.collectionName || process.env.QDRANT_COLLECTION || "documents";
    this.vectorSize =
      config.vectorSize || parseInt(process.env.VECTOR_SIZE || "768");

    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      provider:
        config.embeddingProvider || process.env.EMBEDDING_PROVIDER || "gemini",
      ...config.embeddingConfig,
    });
  }

  /**
   * Initialize collection (create if not exists)
   */
  async ensureCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        console.log(
          `[Qdrant] Creating collection: ${this.collectionName} with vector size: ${this.vectorSize}`
        );
        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: "Cosine",
          },
        });
        console.log(`[Qdrant] Created collection: ${this.collectionName}`);
      } else {
        console.log(`[Qdrant] Collection exists: ${this.collectionName}`);
      }
    } catch (error: any) {
      console.error(
        `[Qdrant] Error ensuring collection:`,
        error.message || error
      );
      throw error;
    }
  }

  /**
   * Store a single document with its embedding
   */
  async storeDocument(
    id: string | number,
    text: string,
    metadata?: DocumentMetadata
  ): Promise<void> {
    try {
      await this.ensureCollection();

      // Generate embedding
      const embedding = await this.embeddingService.embed(text);
      console.log(
        `[Qdrant] Store - Embedding size: ${embedding.length}, Expected: ${this.vectorSize}`
      );

      // Store in Qdrant
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: embedding,
            payload: {
              ...metadata,
              text,
            },
          },
        ],
      });

      console.log(`[Qdrant] Stored document: ${id}`);
    } catch (error: any) {
      console.error(`[Qdrant] Error storing document:`, error.message);
      throw error;
    }
  }

  /**
   * Store multiple documents in batch
   */
  async storeBatch(
    documents: Array<{
      id: string | number;
      text: string;
      metadata?: DocumentMetadata;
    }>
  ): Promise<void> {
    try {
      await this.ensureCollection();

      // Generate embeddings for all documents
      const texts = documents.map((doc) => doc.text);
      const embeddings = await this.embeddingService.embedBatch(texts);

      // Prepare points
      const points = documents.map((doc, index) => ({
        id: doc.id,
        vector: embeddings[index],
        payload: {
          text: doc.text,
          ...doc.metadata,
        },
      }));

      // Store in Qdrant
      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      console.log(`[Qdrant] Stored ${documents.length} documents`);
    } catch (error: any) {
      console.error(`[Qdrant] Error storing batch:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    limit: number = 5,
    filter?: any
  ): Promise<SearchResult[]> {
    try {
      await this.ensureCollection();

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query);
      console.log(
        `[Qdrant] Search - Query embedding size: ${queryEmbedding.length}, Collection: ${this.collectionName}`
      );

      // Search in Qdrant
      const results = await this.client.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        filter,
        with_payload: true,
      });

      // Format results
      return results.map((result) => ({
        id: result.id,
        score: result.score,
        text: (result.payload?.text as string) || "",
        metadata: result.payload as DocumentMetadata,
      }));
    } catch (error: any) {
      console.error(
        `[Qdrant] Error searching:`,
        error.message || error,
        error.data || ""
      );
      throw error;
    }
  }

  /**
   * Search with user-specific filter
   */
  async searchByUser(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    return this.search(query, limit, {
      must: [{ key: "user_id", match: { value: userId } }],
    });
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string | number): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      });
      console.log(`[Qdrant] Deleted document: ${id}`);
    } catch (error: any) {
      console.error(`[Qdrant] Error deleting document:`, error.message);
      throw error;
    }
  }

  /**
   * Delete all documents for a user
   */
  async deleteByUser(userId: string): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [{ key: "user_id", match: { value: userId } }],
        },
      });
      console.log(`[Qdrant] Deleted all documents for user: ${userId}`);
    } catch (error: any) {
      console.error(`[Qdrant] Error deleting by user:`, error.message);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string | number): Promise<SearchResult | null> {
    try {
      const result = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
      });

      if (result.length === 0) return null;

      const point = result[0];
      return {
        id: point.id,
        score: 1.0, // Direct retrieval, not a search
        text: (point.payload?.text as string) || "",
        metadata: point.payload as DocumentMetadata,
      };
    } catch (error: any) {
      console.error(`[Qdrant] Error getting document:`, error.message);
      return null;
    }
  }

  /**
   * Count documents in collection
   */
  async countDocuments(userId?: string): Promise<number> {
    try {
      const filter = userId
        ? { must: [{ key: "user_id", match: { value: userId } }] }
        : undefined;

      const result = await this.client.count(this.collectionName, {
        filter,
        exact: true,
      });

      return result.count;
    } catch (error: any) {
      console.error(`[Qdrant] Error counting documents:`, error.message);
      return 0;
    }
  }

  /**
   * List documents with pagination (user-specific)
   */
  async listDocuments(
    userId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchResult[]> {
    try {
      const filter = userId
        ? { must: [{ key: "user_id", match: { value: userId } }] }
        : undefined;

      const result = await this.client.scroll(this.collectionName, {
        filter,
        limit,
        offset,
        with_payload: true,
      });

      return result.points.map((point) => ({
        id: point.id,
        score: 1.0,
        text: (point.payload?.text as string) || "",
        metadata: point.payload as DocumentMetadata,
      }));
    } catch (error: any) {
      console.error(`[Qdrant] Error listing documents:`, error.message);
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let qdrantInstance: QdrantService | null = null;

export function getQdrantService(): QdrantService {
  if (!qdrantInstance) {
    qdrantInstance = new QdrantService({});
  }
  return qdrantInstance;
}

export function resetQdrantService(): void {
  qdrantInstance = null;
}
