# Quick Start Guide

Get your AI chat server up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or Supabase)
- Gemini API key (or OpenAI/Ollama)

## Step 1: Clone and Install

```bash
cd vercel-supabase-auth-server
npm install
```

## Step 2: Configure Environment

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-random-secret-key-here

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
EMBEDDING_PROVIDER=gemini
```

Get your Gemini API key from: https://makersuite.google.com/app/apikey

## Step 3: Setup Database

Run the SQL scripts in order:

```sql
-- 1. Create users table
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create user_details table
-- Copy from migrations/001_add_user_details.sql
```

Or run the migration file:

```bash
psql $DATABASE_URL -f migrations/001_add_user_details.sql
```

## Step 4: Start Server

```bash
npm run dev
```

Server will start at http://localhost:3001

## Step 5: Test the API

### Register a user:

```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

### Approve user in database:

```sql
UPDATE app_users SET approved = true WHERE email = 'test@example.com';
```

### Login:

```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Save the token from response.

### Chat with AI:

```bash
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message":"Hello! Tell me about AI."}'
```

## Step 6: Configure Your AI (Optional)

Update AI settings:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "llm_model": "gemini",
    "preferences": {
      "tone": "professional",
      "language": "english"
    },
    "personal_info": {
      "name": "Your Name",
      "interests": ["programming", "AI"]
    }
  }'
```

## Using Different LLM Providers

### OpenAI GPT

1. Add to `.env`:

```env
OPENAI_API_KEY=your-openai-key
```

2. Update settings:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "llm_model": "gpt",
    "llm_config": {
      "model": "gpt-4",
      "temperature": 0.7
    }
  }'
```

### Ollama (Local)

1. Install Ollama: https://ollama.ai

2. Pull a model:

```bash
ollama pull llama2
```

3. Add to `.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
```

4. Update settings:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "llm_model": "ollama",
    "llm_config": {
      "model": "llama2",
      "temperature": 0.7
    }
  }'
```

## Using Custom Embeddings (FastAPI)

1. Setup FastAPI server:

```bash
cd fastapi-embedding-example
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

2. Update `.env`:

```env
EMBEDDING_PROVIDER=fastapi
FASTAPI_EMBEDDING_URL=http://localhost:8000
```

3. Update settings:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "embedding_provider": "fastapi"
  }'
```

## Streaming Chat (SSE)

For real-time streaming responses:

```javascript
const eventSource = new EventSource("http://localhost:3001/ai/chat/stream", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "Hello!" }),
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.chunk) {
    process.stdout.write(data.chunk);
  } else if (data.done) {
    console.log("\nDone!");
    eventSource.close();
  }
};
```

## RAG (Retrieval Augmented Generation)

1. Generate embeddings for your documents:

```bash
curl -X POST http://localhost:3001/ai/embed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "texts": [
      "Document 1 content...",
      "Document 2 content...",
      "Document 3 content..."
    ]
  }'
```

2. Store embeddings in a vector database (e.g., pgvector, Pinecone, Weaviate)

3. Retrieve relevant documents and pass as context:

```bash
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What is quantum computing?",
    "context": [
      "Quantum computing uses qubits...",
      "Superposition allows qubits to be in multiple states..."
    ]
  }'
```

## Troubleshooting

### Database Connection Error

- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Verify user has proper permissions

### API Key Error

- Verify GEMINI_API_KEY or OPENAI_API_KEY is set
- Check API key is valid and has credits
- Ensure no extra spaces in .env file

### Token Invalid

- Check JWT_SECRET is same across restarts
- Verify token hasn't expired (7 days)
- Re-login to get fresh token

### SSE Not Working

- Check if your hosting supports streaming
- Use `/ai/chat` endpoint instead for static responses
- Verify CORS settings if accessing from browser

## Next Steps

- 📖 Read [API_DOCS.md](API_DOCS.md) for complete API reference
- 🏗️ Implement vector database for RAG
- 🔒 Add rate limiting and security measures
- 📊 Add logging and monitoring
- 🚀 Deploy to production

## Production Deployment

### Railway

```bash
railway login
railway init
railway add DATABASE_URL
railway up
```

### Render

1. Connect GitHub repo
2. Add environment variables
3. Deploy

### DigitalOcean App Platform

1. Create new app from GitHub
2. Configure environment variables
3. Deploy

**Note:** For SSE support, avoid Vercel serverless functions. Use traditional server deployments.

## Support

- Check [README.md](README.md) for architecture overview
- Review [API_DOCS.md](API_DOCS.md) for endpoint details
- Open an issue for bugs or questions

Happy coding! 🚀
