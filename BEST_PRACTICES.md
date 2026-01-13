# Production Best Practices Implementation

This document outlines all the production-ready best practices that have been implemented in the AI Chat Server.

## 1. Rate Limiting

### Overview

Rate limiting is implemented using `express-rate-limit` to protect the API from abuse and ensure fair resource allocation.

### Configuration

**Location:** `src/middleware/rateLimiting.ts`

#### Rate Limiters

1. **API Limiter** (General endpoints)

   - Limit: 100 requests per 15 minutes
   - Scope: Per IP address
   - Skip: Admin API key holders (exempted for admin operations)
   - Used on: `/admin/*` endpoints

2. **Auth Limiter** (Authentication endpoints)

   - Limit: 5 requests per 15 minutes
   - Scope: Per email address (for login/register)
   - Used on: `/register`, `/login` endpoints
   - Purpose: Prevent brute force attacks

3. **Chat Limiter** (Chat endpoints)

   - Limit: 30 requests per 15 minutes
   - Scope: Per user (via JWT token)
   - Used on: `/chat`, `/chat/stream` endpoints
   - Purpose: Prevent token waste from excessive requests

4. **Embedding Limiter** (Embedding endpoints)
   - Limit: 50 requests per 15 minutes
   - Scope: Per user (via JWT token)
   - Used on: `/embed` endpoint
   - Purpose: Control embedding API usage

### Usage

```typescript
import {
  chatLimiter,
  authLimiter,
  apiLimiter,
  embeddingLimiter,
} from "../middleware/rateLimiting.js";

// Apply to routes
router.post("/chat", chatLimiter, authenticateUser, async (req, res) => {
  // Handler
});
```

### Rate Limit Headers

All responses include standard rate limit headers:

```
RateLimit-Limit: 30
RateLimit-Remaining: 29
RateLimit-Reset: 1234567890
```

---

## 2. Input Validation

### Overview

Comprehensive input validation ensures data integrity and prevents malicious or malformed requests.

### Validation Functions

**Location:** `src/middleware/rateLimiting.ts`

#### Available Validators

1. **validateMessage(message: string)**

   - Checks: Type, non-empty, length (max 10,000 chars)
   - Returns: Array of ValidationError

2. **validateContextArray(context: any)**

   - Checks: Array type, max 10 items, each item is string (max 5,000 chars)
   - Used in: Chat endpoints for RAG context
   - Returns: Array of ValidationError

3. **validateEmbeddingText(text: string)**

   - Checks: Type, non-empty, length (max 10,000 chars)
   - Used in: Single embedding request
   - Returns: Array of ValidationError

4. **validateEmbeddingBatch(texts: any[])**
   - Checks: Array type, non-empty, max 100 items
   - Each item: String type, max 10,000 chars
   - Used in: Batch embedding requests
   - Returns: Array of ValidationError

### Usage

```typescript
import {
  validateMessage,
  sendValidationErrors,
} from "../middleware/rateLimiting.js";

// In route handler
const messageErrors = validateMessage(message);
if (messageErrors.length > 0) {
  return sendValidationErrors(res, messageErrors);
}
```

### Validation Error Response

```json
{
  "error": "validation failed",
  "details": [
    {
      "field": "message",
      "message": "message too long (max 10000 chars, got 15000)"
    }
  ]
}
```

---

## 3. Conversation History Management

### Overview

Smart conversation history management keeps token usage within limits while preserving the most relevant conversation context.

### Utilities

**Location:** `src/utils/conversationHistory.ts`

#### Key Constants

- `MAX_HISTORY_TOKENS`: 8000 (approximately 32KB of text)
- `CLEANUP_THRESHOLD`: 80% (triggers cleanup at this capacity)

#### Available Functions

1. **smartTrimConversationHistory(history, maxMessages = 20, hoursToKeep = 24)**

   - Applies all trimming strategies intelligently
   - Returns: Trimmed conversation history array
   - Order: By token count → by age → by count

2. **trimConversationHistory(history)**

   - Keeps most recent messages within token limit (MAX_HISTORY_TOKENS)
   - Returns: Trimmed history
   - Best for: Token budget management

3. **trimByAge(history, hoursToKeep = 24)**

   - Removes messages older than specified hours
   - Returns: Recent conversation history
   - Best for: Freshness and relevance

4. **trimToLastN(history, count = 20)**

   - Keeps only the last N messages
   - Returns: Limited conversation history
   - Best for: Context window management

5. **shouldCleanupHistory(history)**

   - Checks if history is at 80% capacity
   - Returns: Boolean
   - Used for: Proactive cleanup decisions

6. **estimateTokens(text)**
   - Rough token estimation (chars/4)
   - Returns: Estimated token count
   - Accuracy: ~80% for English text

### Usage

```typescript
import { smartTrimConversationHistory, shouldCleanupHistory } from "../utils/conversationHistory.js";

// In route handler
let history = userDetail.get("conversation_history") || [];

// Proactive cleanup
if (shouldCleanupHistory(history)) {
  history = smartTrimConversationHistory(history);
}

// Before saving
updatedHistory = smartTrimConversationHistory(updatedHistory);
await UserDetail.update({ conversation_history: updatedHistory }, ...);
```

### Message Structure

```typescript
interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string; // ISO 8601 format
}
```

---

## 4. Embedding Caching and Normalization

### Overview

Embedding caching reduces API calls and improves performance. Normalization ensures consistent similarity calculations.

### Utilities

**Location:** `src/utils/embedding.ts`

#### EmbeddingCache Class

A simple in-memory cache for embeddings with LRU eviction:

```typescript
const cache = new EmbeddingCache(
  (maxSize = 1000),
  (ttlMs = 24 * 60 * 60 * 1000)
);

// Get from cache
const embedding = cache.get(text);

// Set in cache
cache.set(text, embedding);

// Get stats
const stats = cache.getStats(); // { size, maxSize, utilization }

// Clear cache
cache.clear();
```

#### Normalization Functions

1. **normalizeEmbedding(embedding: number[])**

   - Converts embedding to unit vector
   - Returns: Normalized embedding
   - Important for: Cosine similarity calculation

2. **normalizeEmbeddings(embeddings: number[][])**

   - Batch normalization
   - Returns: Array of normalized embeddings

3. **cosineSimilarity(a: number[], b: number[])**

   - Calculates similarity between two embeddings
   - Returns: Value between -1 and 1 (1 = identical)
   - Uses: Normalized vectors internally

4. **euclideanDistance(a: number[], b: number[])**

   - Calculates distance between embeddings
   - Returns: Distance value (lower = more similar)

5. **findSimilarEmbeddings(queryEmbedding, textEmbeddings, topK = 5)**
   - Finds most similar embeddings
   - Returns: Array of SimilarityResult with text, similarity score, index
   - Used for: RAG retrieval

### Usage

```typescript
import {
  getGlobalEmbeddingCache,
  normalizeEmbedding,
  cosineSimilarity,
} from "../utils/embedding.js";

// In route handler
const cache = getGlobalEmbeddingCache();
let embedding = cache.get(text);

if (!embedding) {
  embedding = await embeddingService.embed(text);
  embedding = normalizeEmbedding(embedding);
  cache.set(text, embedding);
}

// Calculate similarity
const similarity = cosineSimilarity(embedding1, embedding2);
```

### Global Cache

```typescript
// Get global cache instance (singleton)
const cache = getGlobalEmbeddingCache();

// Reset global cache
resetGlobalEmbeddingCache();
```

---

## 5. Implementation Checklist

### Chat Routes (`src/routes/chat.ts`)

- ✅ Rate limiting applied to `/chat` and `/chat/stream`
- ✅ Input validation for message and context
- ✅ Conversation history trimming before save
- ✅ Proactive history cleanup check
- ✅ Timestamp tracking for messages
- ✅ Embedding cache for `/embed` endpoint
- ✅ Embedding normalization

### Auth Routes (`src/routes/auth.ts`)

- ✅ Rate limiting on `/register` (authLimiter)
- ✅ Rate limiting on `/login` (authLimiter)
- ✅ Rate limiting on admin endpoints (apiLimiter)
- ✅ Admin API key exemption from rate limiting

---

## 6. Performance Optimization Tips

### Token Management

- Monitor conversation history size with `shouldCleanupHistory()`
- Use `estimateTokens()` to stay within model limits
- Trim aggressively for long conversations

### Caching Strategy

- Cache frequently used embeddings globally
- Set appropriate TTL (default 24 hours)
- Monitor cache hit rate with `getStats()`
- Clear cache during peak hours if needed

### Rate Limiting

- Adjust limits based on API provider quotas
- Exempt important users from rate limiting if needed
- Monitor rate limit headers in responses

### Validation Performance

- Validate early in request pipeline
- Use specific validators for each input type
- Return early on validation failure

---

## 7. Monitoring and Logging

### Built-in Logging

```typescript
// History cleanup
console.log(`[CLEANUP] Trimmed history for user ${user.id}`);

// Embedding cache stats
const stats = cache.getStats();
console.log(`Cache utilization: ${stats.utilization}`);

// Error logging
console.error("Chat error:", error);
```

### Recommended Metrics to Track

- Rate limit hit rate
- Validation error frequency
- History cleanup frequency
- Embedding cache hit rate
- Average conversation size
- API response times

---

## 8. Configuration Environment Variables

```bash
# Rate Limiting (hardcoded, can be moved to .env)
RATE_LIMIT_API_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_API_MAX=100
RATE_LIMIT_AUTH_WINDOW_MS=900000         # 15 minutes
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_CHAT_WINDOW_MS=900000         # 15 minutes
RATE_LIMIT_CHAT_MAX=30
RATE_LIMIT_EMBEDDING_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_EMBEDDING_MAX=50

# Input Validation (hardcoded, can be moved to .env)
MAX_MESSAGE_LENGTH=10000
MAX_CONTEXT_ITEMS=10
MAX_CONTEXT_ITEM_LENGTH=5000
MAX_EMBEDDING_TEXT_LENGTH=10000
MAX_EMBEDDING_BATCH_SIZE=100

# History Management (hardcoded, can be moved to .env)
MAX_HISTORY_TOKENS=8000
MAX_HISTORY_MESSAGES=20
HISTORY_KEEP_HOURS=24
HISTORY_CLEANUP_THRESHOLD=0.8
```

---

## 9. Security Considerations

### Input Validation

- All user inputs are validated before processing
- Length limits prevent buffer overflow attacks
- Type checking prevents injection attacks

### Rate Limiting

- Prevents brute force attacks on auth endpoints
- Protects API from resource exhaustion
- Admin users can bypass general rate limits

### Token Limits

- Conversation history is trimmed to prevent token waste
- Message length limits prevent oversized requests
- Embedding batch limits prevent memory issues

### Caching

- In-memory cache is not persisted
- Cache is cleared on application restart
- TTL ensures outdated data is removed

---

## 10. Future Enhancements

1. **Redis Caching**: Move embedding cache to Redis for multi-instance deployments
2. **Database Logging**: Store validation errors and rate limit events in database
3. **Custom Rate Limits**: Per-user configurable rate limits
4. **Smart Trimming**: ML-based importance ranking for history retention
5. **Compression**: Compress conversation history for storage efficiency
6. **Analytics**: Track validation errors, cache hit rates, cleanup frequency
7. **Configuration UI**: Admin panel for adjusting limits and thresholds
8. **Persistent Cache**: Store embeddings in database for long-term reuse

---

## 11. Testing Guidelines

### Unit Tests

```typescript
// Test validation
const errors = validateMessage("hello world");
expect(errors.length).toBe(0);

const longErrors = validateMessage("a".repeat(10001));
expect(longErrors.length).toBeGreaterThan(0);
```

### Integration Tests

```typescript
// Test rate limiting
const responses = await Promise.all(
  Array(31)
    .fill(null)
    .map(() => chat(message, token))
);
// 31st request should be rate limited
expect(responses[30].status).toBe(429);
```

### Load Tests

```typescript
// Test under heavy load
const users = 100;
const requestsPerUser = 100;
// Monitor memory, response times, and error rates
```

---

## 12. Troubleshooting

### High Memory Usage

- Check embedding cache size: `cache.getStats()`
- Reduce cache size or TTL
- Monitor for memory leaks in history trimming

### Rate Limit Errors

- Adjust rate limit thresholds in middleware
- Implement exponential backoff in client
- Use WebSocket or message queue for high-frequency requests

### Validation Errors

- Check input data format
- Verify field names match API spec
- Test with Postman collection

### Slow Embeddings

- Check cache hit rate
- Optimize batch size
- Consider using faster embedding provider

---

## Quick Reference

```typescript
// Rate Limiting
import {
  chatLimiter,
  validateMessage,
  sendValidationErrors,
} from "../middleware/rateLimiting.js";

// History Management
import {
  smartTrimConversationHistory,
  shouldCleanupHistory,
} from "../utils/conversationHistory.js";

// Embedding Utilities
import {
  getGlobalEmbeddingCache,
  normalizeEmbedding,
} from "../utils/embedding.js";
```
