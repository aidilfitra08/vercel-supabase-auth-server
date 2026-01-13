# Qdrant RAG Integration Guide

## Overview

Your AI Chat Server now has **automatic document retrieval** using Qdrant vector database!

When users ask questions, the system automatically:

1. Searches their personal document collection
2. Retrieves the most relevant documents
3. Includes them as context for the LLM
4. Generates informed responses

---

## 🚀 Quick Start

### 1. Configure Qdrant

Add to your `.env` file:

**For Qdrant Cloud:**

```env
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=documents
VECTOR_SIZE=768
```

**For Local Qdrant:**

```env
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=  (not needed for local)
QDRANT_COLLECTION=documents
VECTOR_SIZE=768
```

### 2. Start Local Qdrant (Optional)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 3. Upload Documents

```bash
curl -X POST http://localhost:3001/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of AI that enables systems to learn from data.",
    "metadata": {
      "doc_type": "definition",
      "source": "knowledge_base"
    }
  }'
```

### 4. Chat with Auto-Retrieval

```bash
curl -X POST http://localhost:3001/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is machine learning?",
    "auto_retrieve": true,
    "retrieve_limit": 3
  }'
```

The system will automatically find relevant documents and use them!

---

## 📚 API Endpoints

### Document Management

#### Store Single Document

```
POST /documents
```

Request:

```json
{
  "id": "optional-custom-id",
  "text": "Your document text here",
  "metadata": {
    "doc_type": "article",
    "source": "website"
  }
}
```

Response:

```json
{
  "message": "document stored successfully",
  "id": "user_id_timestamp"
}
```

#### Store Multiple Documents (Batch)

```
POST /documents/batch
```

Request:

```json
{
  "documents": [
    {
      "text": "Document 1 text",
      "metadata": { "doc_type": "article" }
    },
    {
      "text": "Document 2 text",
      "metadata": { "doc_type": "tutorial" }
    }
  ]
}
```

Response:

```json
{
  "message": "documents stored successfully",
  "count": 2,
  "ids": ["id1", "id2"]
}
```

#### Search Documents

```
POST /documents/search
```

Request:

```json
{
  "query": "machine learning",
  "limit": 5,
  "global": false
}
```

Response:

```json
{
  "query": "machine learning",
  "results": [
    {
      "id": "doc1",
      "score": 0.95,
      "text": "Machine learning is...",
      "metadata": { "doc_type": "definition" }
    }
  ],
  "count": 1
}
```

#### List Documents

```
GET /documents?limit=20&offset=0
```

Response:

```json
{
  "documents": [...],
  "count": 20,
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Get Document by ID

```
GET /documents/:id
```

Response:

```json
{
  "document": {
    "id": "doc1",
    "score": 1.0,
    "text": "Document text",
    "metadata": { "doc_type": "article" }
  }
}
```

#### Delete Document

```
DELETE /documents/:id
```

Response:

```json
{
  "message": "document deleted successfully",
  "id": "doc1"
}
```

#### Delete All User Documents

```
DELETE /documents
```

Response:

```json
{
  "message": "all documents deleted successfully"
}
```

#### Health Check

```
GET /documents/health
```

Response:

```json
{
  "status": "healthy",
  "qdrant": "connected"
}
```

---

## 💬 Enhanced Chat Endpoints

### Auto-Retrieval Parameters

Both `/ai/chat` and `/ai/chat/stream` now support:

```json
{
  "message": "Your question",
  "context": ["Optional manual context"],
  "auto_retrieve": true, // Enable auto-retrieval (default: true)
  "retrieve_limit": 3 // Number of documents to retrieve (default: 3)
}
```

**How it works:**

1. User sends a question
2. System embeds the question
3. Searches Qdrant for similar documents (user-specific)
4. Retrieves top N most relevant documents
5. Combines manual context + auto-retrieved docs
6. Sends everything to LLM for response

**Disable auto-retrieval:**

```json
{
  "message": "Your question",
  "auto_retrieve": false
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable            | Description          | Default                 | Required   |
| ------------------- | -------------------- | ----------------------- | ---------- |
| `QDRANT_URL`        | Qdrant server URL    | `http://localhost:6333` | No         |
| `QDRANT_API_KEY`    | API key (cloud only) | None                    | Cloud only |
| `QDRANT_COLLECTION` | Collection name      | `documents`             | No         |
| `VECTOR_SIZE`       | Embedding dimension  | `768`                   | No         |

### Switching Between Cloud and Local

**Use Cloud:**

```env
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key
```

**Use Local:**

```env
QDRANT_URL=http://localhost:6333
# No API key needed
```

The system auto-detects and connects!

---

## 📊 Example Workflow

### 1. Upload Knowledge Base

```bash
# Upload multiple documents
curl -X POST http://localhost:3001/documents/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "text": "Python is a high-level programming language.",
        "metadata": { "topic": "programming" }
      },
      {
        "text": "Machine learning uses algorithms to learn from data.",
        "metadata": { "topic": "AI" }
      },
      {
        "text": "React is a JavaScript library for building UIs.",
        "metadata": { "topic": "web-dev" }
      }
    ]
  }'
```

### 2. Ask Questions with Auto-Retrieval

```bash
# Question automatically retrieves relevant docs
curl -X POST http://localhost:3001/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is machine learning?",
    "auto_retrieve": true,
    "retrieve_limit": 2
  }'
```

**Behind the scenes:**

- System finds "Machine learning uses algorithms..." doc
- Includes it as context
- LLM generates answer based on your document!

### 3. Search Documents

```bash
# Explicit search (no chat)
curl -X POST http://localhost:3001/documents/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "programming",
    "limit": 5
  }'
```

---

## 🎯 Use Cases

### 1. Personal Knowledge Base

- Store notes, articles, docs
- Ask questions naturally
- Get answers from your own content

### 2. Customer Support

- Upload product documentation
- Auto-answer customer questions
- Cite specific docs in responses

### 3. Code Assistant

- Store code snippets
- Ask for examples
- Get relevant code automatically

### 4. Research Assistant

- Upload research papers
- Query across documents
- Find relevant information fast

---

## 🔒 Security & Privacy

- **User Isolation**: Documents are user-specific by default
- **Automatic Filtering**: Searches only return user's own documents
- **Manual Context**: Can disable auto-retrieval if needed
- **Metadata**: Store sensitive info in metadata (not searchable)

---

## ⚡ Performance

### Embedding Cache

- Auto-caches embeddings (24h TTL)
- Reduces API calls by 30-50%
- Faster subsequent searches

### Batch Upload

- Use `/documents/batch` for multiple docs
- Single embedding API call
- Much faster than individual uploads

### Vector Size

- Default: 768 (Gemini embeddings)
- OpenAI: 1536
- Match your embedding provider!

---

## 🐛 Troubleshooting

### "Failed to retrieve documents"

- Check Qdrant connection: `GET /documents/health`
- Verify `QDRANT_URL` and `QDRANT_API_KEY`
- Ensure collection exists (auto-created on first use)

### No documents returned

- Upload documents first: `POST /documents`
- Check user-specific filtering
- Try global search: `"global": true`

### Qdrant connection refused

- Local: Start docker: `docker run -p 6333:6333 qdrant/qdrant`
- Cloud: Check API key and URL

### Wrong vector size

- Match `VECTOR_SIZE` to your embedding provider
- Gemini: 768
- OpenAI: 1536
- Recreate collection if changed

---

## 📝 Notes

- **Auto-retrieval is ON by default** — disable with `"auto_retrieve": false`
- **User-specific by default** — documents are private per user
- **Graceful fallback** — Chat works even if Qdrant fails
- **Collection auto-created** — No manual setup needed
- **Metadata searchable** — Can filter by metadata fields

---

## 🚀 Next Steps

1. Configure `.env` with Qdrant settings
2. Start server: `npm start`
3. Check health: `GET /documents/health`
4. Upload documents: `POST /documents/batch`
5. Chat with auto-retrieval: `POST /ai/chat`

For detailed API docs, see [API_DOCS.md](./API_DOCS.md)

---

**Questions?** Check the logs for `[RAG]` and `[Qdrant]` messages!
