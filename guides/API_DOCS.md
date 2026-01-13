# API Documentation

## Base URL

```
http://localhost:3001  (development)
https://your-app.vercel.app  (production)
```

## Authentication

All AI endpoints require a JWT token obtained from the `/login` endpoint.

**Header Format:**

```
Authorization: Bearer <your_jwt_token>
```

## Admin Authentication

Admin endpoints require an API key in the request header.

**Header Format:**

```
X-API-Key: <your_admin_api_key>
```

Set the `ADMIN_API_KEY` in your `.env` file.

---

## Auth Endpoints

### Register User

**POST** `/register`

Creates a new user account (requires admin approval).

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe" // optional
}
```

**Response (201):**

```json
{
  "message": "registered, pending approval",
  "userId": "uuid-here"
}
```

**Response (409):**

```json
{
  "error": "user already exists"
}
```

---

### Login

**POST** `/login`

Authenticate and receive JWT token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200) - Approved:**

```json
{
  "token": "jwt_token_here",
  "approved": true
}
```

**Response (200) - Pending:**

```json
{
  "approved": false,
  "message": "pending approval"
}
```

**Response (401):**

```json
{
  "error": "invalid credentials"
}
```

---

### Get Current User

**GET** `/me`

Get authenticated user's profile.

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "approved": true
}
```

---

## Admin Endpoints

### Get All Users

**GET** `/admin/users`

Get list of all registered users.

**Headers:**

```
X-API-Key: <admin_api_key>
```

**Response (200):**

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "password_hash": "hashed_password",
      "approved": false,
      "created_at": "2026-01-13T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Response (403):**

```json
{
  "error": "forbidden: invalid or missing API key"
}
```

---

### Update User Approval Status

**PATCH** `/admin/users/:userId/approval`

Approve or reject a user account.

**Headers:**

```
X-API-Key: <admin_api_key>
Content-Type: application/json
```

**URL Parameters:**

- `userId` - User UUID

**Request Body:**

```json
{
  "approved": true
}
```

Set `approved` to `true` to approve, `false` to reject/unapprove.

**Response (200):**

```json
{
  "message": "user approved successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "approved": true
  }
}
```

**Response (400):**

```json
{
  "error": "approved must be a boolean"
}
```

**Response (403):**

```json
{
  "error": "forbidden: invalid or missing API key"
}
```

**Response (404):**

```json
{
  "error": "user not found"
}
```

---

## AI Chat Endpoints

### Chat with Streaming (SSE)

**POST** `/ai/chat/stream`

Chat with AI using Server-Sent Events for real-time streaming responses.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "What is machine learning?",
  "context": [
    "Machine learning is a subset of AI...",
    "Neural networks are a type of..."
  ] // optional RAG context
}
```

**Response:**
Server-Sent Events stream:

```
data: {"chunk":"Machine"}

data: {"chunk":" learning"}

data: {"chunk":" is..."}

data: {"done":true}
```

**Client Example:**

```javascript
const response = await fetch("/ai/chat/stream", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Hello!",
    context: [],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      if (data.chunk) {
        console.log(data.chunk);
      } else if (data.done) {
        console.log("Stream complete");
      }
    }
  }
}
```

---

### Chat without Streaming

**POST** `/ai/chat`

Chat with AI and receive complete response at once.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "Explain quantum computing",
  "context": ["optional context array"]
}
```

**Response (200):**

```json
{
  "response": "Quantum computing is a type of computation that...",
  "message": "Explain quantum computing"
}
```

---

### Generate Embeddings

**POST** `/ai/embed`

Generate embeddings for text(s) using configured embedding provider.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Single):**

```json
{
  "text": "The quick brown fox jumps over the lazy dog"
}
```

**Response (Single):**

```json
{
  "embedding": [0.123, -0.456, 0.789, ...]
}
```

**Request Body (Batch):**

```json
{
  "texts": [
    "First document to embed",
    "Second document to embed",
    "Third document to embed"
  ]
}
```

**Response (Batch):**

```json
{
  "embeddings": [
    [0.123, -0.456, ...],
    [0.789, -0.012, ...],
    [0.345, -0.678, ...]
  ]
}
```

---

### Get AI Settings

**GET** `/ai/settings`

Get current user's AI configuration and preferences.

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "llm_model": "gemini",
  "llm_config": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2048
  },
  "embedding_provider": "gemini",
  "embedding_config": {},
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

---

### Update AI Settings

**PUT** `/ai/settings`

Update user's AI configuration and preferences.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "llm_model": "gpt",
  "llm_config": {
    "model": "gpt-4",
    "temperature": 0.8,
    "maxTokens": 4096
  },
  "embedding_provider": "fastapi",
  "embedding_config": {
    "fastapiUrl": "http://localhost:8000"
  },
  "preferences": {
    "tone": "casual",
    "language": "english",
    "expertise_level": "beginner"
  },
  "personal_info": {
    "name": "John Doe",
    "occupation": "Software Developer",
    "interests": ["AI", "Web Development", "DevOps"]
  }
}
```

**Response (200):**

```json
{
  "message": "settings updated successfully"
}
```

---

### Clear Conversation History

**DELETE** `/ai/history`

Clear user's conversation history.

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "conversation history cleared"
}
```

---

## LLM Provider Configuration

### Gemini

```json
{
  "llm_model": "gemini",
  "llm_config": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2048,
    "apiKey": "optional-override"
  }
}
```

Available models:

- `gemini-pro` (default)
- `gemini-pro-vision`

### OpenAI GPT

```json
{
  "llm_model": "gpt",
  "llm_config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 4096,
    "apiKey": "optional-override"
  }
}
```

Available models:

- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

### Ollama (Local)

```json
{
  "llm_model": "ollama",
  "llm_config": {
    "model": "llama2",
    "temperature": 0.7,
    "maxTokens": 2048,
    "baseURL": "http://localhost:11434/v1"
  }
}
```

Available models (depends on your Ollama setup):

- `llama2`
- `mistral`
- `codellama`
- `mixtral`

---

## Embedding Provider Configuration

### Gemini Embeddings

```json
{
  "embedding_provider": "gemini",
  "embedding_config": {
    "model": "embedding-001",
    "apiKey": "optional-override"
  }
}
```

### FastAPI Custom Embeddings

```json
{
  "embedding_provider": "fastapi",
  "embedding_config": {
    "fastapiUrl": "http://localhost:8000",
    "model": "default"
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "message is required"
}
```

### 401 Unauthorized

```json
{
  "error": "missing token"
}
```

or

```json
{
  "error": "invalid token"
}
```

### 403 Forbidden

```json
{
  "error": "user not approved"
}
```

### 404 Not Found

```json
{
  "error": "user not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "chat failed"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production using:

- `express-rate-limit`
- API Gateway rate limiting
- CDN rate limiting

---

## Best Practices

1. **Always validate tokens** before making AI requests
2. **Handle SSE connection errors** gracefully
3. **Limit context array size** to avoid token limits (max 10 items recommended)
4. **Clear conversation history** periodically to manage database size
5. **Use appropriate temperatures**:

   - 0.0-0.3: Factual, deterministic
   - 0.4-0.7: Balanced (recommended)
   - 0.8-1.0: Creative, varied

6. **Embedding best practices**:
   - Batch embed when possible
   - Cache embeddings for frequently used texts
   - Normalize embeddings for cosine similarity

---

## Example Full Flow

```javascript
// 1. Register
const registerRes = await fetch("/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "john@example.com",
    password: "secure123",
    name: "John Doe",
  }),
});

// 2. Login (after admin approval)
const loginRes = await fetch("/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "john@example.com",
    password: "secure123",
  }),
});
const { token } = await loginRes.json();

// 3. Configure AI settings
await fetch("/ai/settings", {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    llm_model: "gemini",
    preferences: { tone: "professional" },
    personal_info: { name: "John", interests: ["AI"] },
  }),
});

// 4. Chat with AI
const chatRes = await fetch("/ai/chat", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "What are the latest trends in AI?",
  }),
});
const { response } = await chatRes.json();
console.log(response);

// 5. Generate embeddings for RAG
const embedRes = await fetch("/ai/embed", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Document to embed for retrieval",
  }),
});
const { embedding } = await embedRes.json();
```
