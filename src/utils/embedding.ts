/**
 * Embedding caching and normalization utilities
 */

export interface CachedEmbedding {
  text: string;
  embedding: number[];
  timestamp: number;
}

/**
 * Simple in-memory embedding cache
 * Note: For production, use Redis or a database
 */
export class EmbeddingCache {
  private cache: Map<string, CachedEmbedding> = new Map();
  private maxSize: number;
  private ttlMs: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from text (hash-like)
   */
  private getKey(text: string): string {
    // Simple hash based on text content
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `emb_${Math.abs(hash)}_${text.length}`;
  }

  /**
   * Get embedding from cache
   */
  get(text: string): number[] | null {
    const key = this.getKey(text);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.embedding;
  }

  /**
   * Set embedding in cache
   */
  set(text: string, embedding: number[]): void {
    // Implement simple LRU - remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const key = this.getKey(text);
    this.cache.set(key, {
      text,
      embedding,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: `${((this.cache.size / this.maxSize) * 100).toFixed(2)}%`,
    };
  }
}

/**
 * Normalize embedding vector (unit vector)
 * This ensures cosine similarity works correctly
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map((val) => val / magnitude);
}

/**
 * Normalize multiple embeddings
 */
export function normalizeEmbeddings(embeddings: number[][]): number[][] {
  return embeddings.map((embedding) => normalizeEmbedding(embedding));
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embedding vectors must have the same length");
  }

  // Use normalized vectors for better performance
  const normA = normalizeEmbedding(a);
  const normB = normalizeEmbedding(b);

  let dotProduct = 0;
  for (let i = 0; i < normA.length; i++) {
    dotProduct += normA[i] * normB[i];
  }

  return dotProduct;
}

/**
 * Euclidean distance between embeddings
 * Lower distance = more similar
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embedding vectors must have the same length");
  }

  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquares += diff * diff;
  }

  return Math.sqrt(sumSquares);
}

/**
 * Find most similar embeddings
 */
export interface SimilarityResult {
  text: string;
  similarity: number;
  index: number;
}

export function findSimilarEmbeddings(
  queryEmbedding: number[],
  textEmbeddings: Array<{ text: string; embedding: number[] }>,
  topK: number = 5
): SimilarityResult[] {
  const similarities = textEmbeddings.map((item, index) => ({
    text: item.text,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
    index,
  }));

  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, topK);
}

/**
 * Batch normalize embeddings efficiently
 */
export function batchNormalize(embeddings: number[][]): number[][] {
  return embeddings.map(normalizeEmbedding);
}

/**
 * Create embedding cache instance
 * Can be used globally or per-user
 */
let globalEmbeddingCache: EmbeddingCache | null = null;

export function getGlobalEmbeddingCache(): EmbeddingCache {
  if (!globalEmbeddingCache) {
    globalEmbeddingCache = new EmbeddingCache();
  }
  return globalEmbeddingCache;
}

export function resetGlobalEmbeddingCache(): void {
  if (globalEmbeddingCache) {
    globalEmbeddingCache.clear();
  }
}
