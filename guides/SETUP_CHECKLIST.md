# 🚀 Complete Project Setup Checklist

Follow this checklist to get your AI Chat Server running!

## ✅ Prerequisites

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database (local or cloud)
- [ ] Gemini API key (get from https://makersuite.google.com/app/apikey)

## 📦 Step 1: Install Dependencies

```bash
cd vercel-supabase-auth-server
npm install
```

**Expected output:** All packages installed successfully

## 🔧 Step 2: Configure Environment

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` with your values:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/your_db
JWT_SECRET=generate-a-random-secret-here
GEMINI_API_KEY=your-gemini-api-key

# Optional (defaults work)
PORT=3001
EMBEDDING_PROVIDER=gemini
```

**Tips:**

- Generate JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Get Gemini key: https://makersuite.google.com/app/apikey

## 🗄️ Step 3: Setup Database

### Option A: Copy & Paste SQL

Connect to your database and run:

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

-- 2. Run the migration file
\i migrations/001_add_user_details.sql
```

### Option B: Use psql

```bash
psql $DATABASE_URL -f migrations/001_add_user_details.sql
```

**Verify:** Check tables exist:

```sql
\dt
```

Should show: `app_users` and `user_details`

## 🏃 Step 4: Start the Server

```bash
npm run dev
```

**Expected output:**

```
Auth server listening on :3001
```

**Verify:** Visit http://localhost:3001
Should see: `{"status":"ok"}`

## 🧪 Step 5: Test the API

### Quick Test (recommended)

Use the provided test script:

```bash
# 1. Register
npm run test:api register

# 2. Approve user in database
psql $DATABASE_URL -c "UPDATE app_users SET approved = true WHERE email = 'test@example.com';"

# 3. Login
npm run test:api login
# Copy the token from output

# 4. Test chat (replace TOKEN with your actual token)
npm run test:api chat YOUR_TOKEN_HERE

# 5. Test streaming
npm run test:api stream YOUR_TOKEN_HERE

# 6. Test embeddings
npm run test:api embed YOUR_TOKEN_HERE
```

### Manual Test (alternative)

Use curl or Postman:

```bash
# Register
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Chat (replace TOKEN)
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message":"Hello!"}'
```

## ✨ Step 6: Configure Your AI (Optional)

```bash
# Update AI settings
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
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

## 🎯 Optional: Additional LLM Providers

### OpenAI GPT

1. Add to `.env`:

```env
OPENAI_API_KEY=sk-your-key-here
```

2. Switch to GPT:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"llm_model":"gpt","llm_config":{"model":"gpt-4"}}'
```

### Ollama (Local)

1. Install Ollama:

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download from https://ollama.ai
```

2. Pull a model:

```bash
ollama pull llama2
```

3. Add to `.env`:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
```

4. Switch to Ollama:

```bash
curl -X PUT http://localhost:3001/ai/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"llm_model":"ollama","llm_config":{"model":"llama2"}}'
```

## 🔢 Optional: Custom Embeddings (FastAPI)

1. Setup Python environment:

```bash
cd fastapi-embedding-example
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. Start FastAPI server:

```bash
python main.py
```

3. Update `.env`:

```env
EMBEDDING_PROVIDER=fastapi
FASTAPI_EMBEDDING_URL=http://localhost:8000
```

4. Test embeddings:

```bash
npm run test:api embed YOUR_TOKEN
```

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Railway

```bash
railway login
railway init
railway add
railway up
```

### Deploy to Render

1. Connect GitHub repo
2. Set environment variables
3. Deploy

**Note:** For SSE streaming support, avoid Vercel serverless. Use Railway, Render, or DigitalOcean.

## 📚 Documentation

- [README.md](README.md) - Overview and architecture
- [API_DOCS.md](API_DOCS.md) - Complete API reference
- [QUICK_START.md](QUICK_START.md) - Getting started guide
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify firewall allows connection

### API Key Invalid

```bash
# Test Gemini key
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

- Verify key is correct
- Check API quotas
- Ensure no extra spaces

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <pid> /F

# macOS/Linux
lsof -ti:3001 | xargs kill
```

### TypeScript Errors

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build
```

## ✅ Success Checklist

- [ ] Server starts without errors
- [ ] Can register a user
- [ ] Can login and get token
- [ ] Can chat with AI (both `/ai/chat` and `/ai/chat/stream`)
- [ ] Can generate embeddings
- [ ] Can update AI settings
- [ ] Database tables created
- [ ] Environment variables set

## 🎉 You're Done!

Your AI Chat Server is ready! Try:

1. **Basic Chat:**

   ```bash
   npm run test:api chat YOUR_TOKEN
   ```

2. **Streaming Chat:**

   ```bash
   npm run test:api stream YOUR_TOKEN
   ```

3. **Check Settings:**
   ```bash
   npm run test:api settings YOUR_TOKEN
   ```

## 📞 Need Help?

- Check [API_DOCS.md](API_DOCS.md) for detailed endpoint documentation
- Review [QUICK_START.md](QUICK_START.md) for usage examples
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details

Happy coding! 🚀
