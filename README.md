# Vercel Supabase Auth Server with AI Chat & RAG

A Node.js server for user registration, authentication, and personalized AI chat with RAG (Retrieval Augmented Generation) support. Features multi-provider LLM support (Gemini, OpenAI, Ollama), flexible embedding options, and both SSE streaming and static chat APIs.

## Features

- 🔐 JWT-based authentication with user approval workflow
- 🤖 Multi-provider LLM support (Gemini, GPT, Ollama)
- 💬 Dual chat APIs (Server-Sent Events streaming & static response)
- 🧠 RAG support with flexible embedding providers (Gemini or FastAPI)
- 👤 Personalized AI with user preferences and context
- 📝 Conversation history management
- ⚙️ Configurable per-user AI settings

## Endpoints

### Authentication

- `POST /register` — `{ email, password, name? }`
  - Creates user in `app_users` with `approved=false`
- `POST /login` — `{ email, password }`
  - Returns `{ approved: false }` if not yet approved
  - Returns `{ token, approved: true }` on success
- `GET /me` — Authorization: `Bearer <token>`
  - Returns user profile and `approved` status

### AI Chat

All AI endpoints require `Authorization: Bearer <token>` header.

- `POST /ai/chat/stream` — Chat with Server-Sent Events (SSE)

  ```json
  {
    "message": "Your question here",
    "context": ["Optional context 1", "Optional context 2"]
  }
  ```

  Returns streaming response with `data: {"chunk": "text"}` events

- `POST /ai/chat` — Chat with static response

  ```json
  {
    "message": "Your question here",
    "context": ["Optional context 1", "Optional context 2"]
  }
  ```

  Returns `{ response: "AI response", message: "Your question" }`

- `POST /ai/embed` — Get embeddings for RAG

  ```json
  {
    "text": "Single text to embed"
  }
  ```

  or

  ```json
  {
    "texts": ["Text 1", "Text 2", "Text 3"]
  }
  ```

- `GET /ai/settings` — Get user's AI configuration
- `PUT /ai/settings` — Update user's AI configuration

  ```json
  {
    "llm_model": "gemini",
    "llm_config": {
      "model": "gemini-pro",
      "temperature": 0.7,
      "maxTokens": 2048
    },
    "embedding_provider": "gemini",
    "preferences": {
      "tone": "professional",
      "language": "english"
    },
    "personal_info": {
      "name": "John",
      "interests": ["programming", "AI"]
    }
  }
  ```

- `DELETE /ai/history` — Clear conversation history

## Environment Variables

Create `.env` based on `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-secret-key-change-in-production
ADMIN_API_KEY=your-admin-api-key-change-in-production
PORT=3001

# LLM API Keys
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434/v1

# Embedding Configuration
EMBEDDING_PROVIDER=gemini  # or "fastapi"
FASTAPI_EMBEDDING_URL=http://localhost:8000

# Default LLM Model
DEFAULT_LLM_MODEL=gemini
```

## Production Best Practices

This server implements production-ready features for reliability and security:

### 🛡️ Rate Limiting

- **Auth endpoints**: 5 requests/15min per email (prevent brute force)
- **Chat endpoints**: 30 requests/15min per user
- **Embedding endpoints**: 50 requests/15min per user
- **Admin endpoints**: 100 requests/15min per IP (admin key holders exempt)

See [BEST_PRACTICES.md](./BEST_PRACTICES.md#1-rate-limiting) for configuration details.

### ✅ Input Validation

- Message length: max 10,000 characters
- Context items: max 10 items, 5,000 chars each
- Embedding text: max 10,000 characters
- Batch embeddings: max 100 items

All validation errors return structured responses with field-level details.

### 💾 Conversation History Management

- Automatic trimming to maintain ~8,000 token limit
- Proactive cleanup at 80% capacity
- Preserves most recent and relevant messages
- Token estimation for memory efficiency

### ⚡ Embedding Caching

- In-memory cache with LRU eviction (1000 max)
- 24-hour TTL for cached embeddings
- Automatic normalization for cosine similarity
- Similarity search utilities for RAG

For detailed implementation guide, see [BEST_PRACTICES.md](./BEST_PRACTICES.md)

## Database Schema

Run in your PostgreSQL database:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User details table for AI personalization
CREATE TABLE IF NOT EXISTS public.user_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  personal_info JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  llm_model TEXT NOT NULL DEFAULT 'gemini',
  llm_config JSONB DEFAULT '{}',
  embedding_provider TEXT NOT NULL DEFAULT 'gemini',
  embedding_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_details_user_id ON user_details(user_id);
```

## LLM Providers

### Gemini (Google)

```javascript
{
  "llm_model": "gemini",
  "llm_config": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

### GPT (OpenAI)

```javascript
{
  "llm_model": "gpt",
  "llm_config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

### Ollama (Local)

```javascript
{
  "llm_model": "ollama",
  "llm_config": {
    "model": "llama2",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

## Embedding Providers

### Gemini Embeddings

Set `EMBEDDING_PROVIDER=gemini` in `.env`

### FastAPI Custom Embeddings

Set `EMBEDDING_PROVIDER=fastapi` and `FASTAPI_EMBEDDING_URL=http://your-server:8000`

Your FastAPI server should implement:

- `POST /embed` — Returns `{ embedding: [numbers] }`
- `POST /embed_batch` — Returns `{ embeddings: [[numbers]] }`

## Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

**Note on SSE Support:** Vercel's serverless functions have limitations with streaming responses. The `/ai/chat/stream` endpoint works best on traditional server deployments. For Vercel deployment, use the `/ai/chat` endpoint (static response) instead.

1. Create a new Vercel project
2. Set environment variables in Vercel dashboard
3. Deploy

For production with SSE support, consider deploying to:

- Railway
- Render
- DigitalOcean App Platform
- AWS EC2/ECS
- Google Cloud Run

## Client Integration Example

```javascript
// Initialize
const API_URL = "https://your-api.vercel.app";
const token = "your-jwt-token";

// Static chat
const response = await fetch(`${API_URL}/ai/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: "Hello, AI!",
    context: ["Relevant document 1", "Relevant document 2"],
  }),
});
const data = await response.json();
console.log(data.response);

// Streaming chat (SSE)
const eventSource = new EventSource(`${API_URL}/ai/chat/stream`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: "Hello, AI!",
  }),
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.chunk) {
    console.log(data.chunk);
  } else if (data.done) {
    eventSource.close();
  }
};
```

## Architecture

```
src/
├── models/
│   ├── user.ts           # User authentication model
│   └── userDetail.ts     # AI personalization model
├── services/
│   ├── llm.ts           # Multi-provider LLM service
│   └── embedding.ts     # Embedding service (Gemini/FastAPI)
├── routes/
│   ├── auth.ts          # Authentication endpoints
│   ├── chat.ts          # AI chat endpoints
│   └── home.ts          # Health check
├── db.ts                # Database utilities
├── sequelize.ts         # Database connection
├── types.ts             # TypeScript types
└── index.ts             # Main server
```

## License

MIT
