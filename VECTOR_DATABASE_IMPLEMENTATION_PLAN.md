# FORCE Vector Database Implementation Plan

## Executive Summary

Add persistent, local vector storage to FORCE using SQLite + sqlite-vec, enabling:
- **Client confidentiality**: All data stays on local machine (C: drive)
- **Persistent memory**: Knowledge survives server restarts
- **Semantic search**: Find relevant content across all uploaded documents
- **Compounding knowledge**: Each project's learnings inform future work
- **Zero cost**: No cloud services, no subscriptions

---

## Problem Statement

### Current Situation
- FORCE runs on Railway (cloud) with Gemini API (cloud)
- Cannot upload confidential client materials (meeting minutes, internal docs)
- No persistent storage — all session data lost on restart
- Senior partner requires "within firewall" deployment for client work

### Constraints
- Aggressive cost cuts — solution must be free or near-free
- Limited IT resources — must be simple to deploy/maintain
- Must handle confidential client materials securely

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL MACHINE (Your Laptop)                                    │
│                                                                 │
│  C:\FORCE\                                                      │
│  ├── server.js                                                  │
│  ├── data\                                                      │
│  │   └── knowledge.db  ← SQLite + sqlite-vec (SINGLE FILE)     │
│  │                       - Document chunks                      │
│  │                       - Vector embeddings                    │
│  │                       - Session history                      │
│  │                       - Metadata & indexes                   │
│  └── server\                                                    │
│      └── vector-store\  ← New module                           │
│          ├── index.js        (public API)                       │
│          ├── database.js     (SQLite connection)                │
│          ├── embeddings.js   (text → vectors)                   │
│          └── chunker.js      (document splitting)               │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────┐                  │
│  │   Your App      │─────▶│   SQLite DB     │                  │
│  │   (Node.js)     │      │   (knowledge.db)│                  │
│  └────────┬────────┘      └─────────────────┘                  │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │  Gemini API     │  ← For embeddings & generation            │
│  │  (free tier)    │    (can swap to Azure OpenAI later)       │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Why SQLite?

| Consideration | SQLite Advantage |
|---------------|------------------|
| **Robustness** | Most tested database in history (~1 trillion deployments) |
| **Simplicity** | Single file, no server process, no configuration |
| **Portability** | Copy file to move entire database |
| **Reliability** | ACID compliant, survives power failures |
| **Longevity** | Public domain, supported until 2050 |
| **Confidentiality** | Data never leaves your machine |

### Why sqlite-vec?

- Purpose-built vector search extension for SQLite
- Maintained by Alex Garcia (respected SQLite extension author)
- Supports cosine similarity, L2 distance, inner product
- Works with any embedding model (Gemini, OpenAI, local)
- No external dependencies

---

## Technical Specification

### Database Schema

```sql
-- Document storage
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_text TEXT,
    upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
    client_name TEXT,
    project_name TEXT,
    metadata TEXT  -- JSON blob for extensibility
);

-- Chunked content with embeddings
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding BLOB,  -- sqlite-vec vector storage
    token_count INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vector index for similarity search
CREATE VIRTUAL TABLE chunks_vec USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    embedding FLOAT[768]  -- Gemini embedding dimension
);

-- Session history for context
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,  -- UUID
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed TEXT,
    prompt TEXT,
    content_type TEXT,  -- 'roadmap', 'slides', 'document'
    generated_content TEXT,  -- JSON blob
    metadata TEXT
);

-- Full-text search index
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    chunk_text,
    content='chunks',
    content_rowid='id'
);

-- Indexes for performance
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_documents_client ON documents(client_name);
CREATE INDEX idx_sessions_accessed ON sessions(last_accessed);
```

### New Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "sqlite-vec": "^0.1.0"
  }
}
```

**Note**: `better-sqlite3` is synchronous (no callback hell) and the fastest SQLite binding for Node.js.

### File Structure Changes

```
server/
├── vector-store/                 # NEW DIRECTORY
│   ├── index.js                  # Public API
│   ├── database.js               # SQLite connection & schema
│   ├── embeddings.js             # Generate embeddings via Gemini
│   ├── chunker.js                # Split documents into chunks
│   └── search.js                 # Vector similarity search
├── config.js                     # MODIFY: Add vector store config
├── routes/
│   └── content.js                # MODIFY: Integrate vector storage
└── gemini.js                     # MODIFY: Add embedding function

data/                             # NEW DIRECTORY
└── knowledge.db                  # SQLite database (auto-created)
```

### API Design

```javascript
// server/vector-store/index.js

/**
 * Initialize the vector store (creates DB if not exists)
 * Call once at server startup
 */
export async function initVectorStore(dbPath = './data/knowledge.db');

/**
 * Store a document and its embeddings
 * @param {Object} doc - { filename, text, clientName?, projectName?, metadata? }
 * @returns {number} documentId
 */
export async function storeDocument(doc);

/**
 * Search for relevant chunks using semantic similarity
 * @param {string} query - Natural language query
 * @param {Object} options - { limit: 10, clientName?, projectName?, minScore? }
 * @returns {Array} Matching chunks with scores
 */
export async function semanticSearch(query, options = {});

/**
 * Get all documents for a client/project
 * @param {Object} filters - { clientName?, projectName? }
 * @returns {Array} Document metadata
 */
export async function listDocuments(filters = {});

/**
 * Delete a document and its embeddings
 * @param {number} documentId
 */
export async function deleteDocument(documentId);

/**
 * Store session for history/context
 * @param {Object} session - { id, prompt, contentType, generatedContent, metadata }
 */
export async function storeSession(session);

/**
 * Retrieve past sessions for context
 * @param {Object} filters - { clientName?, limit? }
 * @returns {Array} Past sessions
 */
export async function getSessionHistory(filters = {});
```

### Embedding Strategy

**Using Gemini's Embedding API (Free Tier):**

```javascript
// server/vector-store/embeddings.js

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

export async function generateEmbedding(text) {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;  // Float32Array[768]
}

export async function generateEmbeddings(texts) {
    // Batch embedding for efficiency
    const results = await Promise.all(
        texts.map(text => generateEmbedding(text))
    );
    return results;
}
```

**Gemini Embedding Specs:**
- Model: `text-embedding-004`
- Dimensions: 768
- Free tier: 1,500 requests/minute
- Max input: 2,048 tokens per request

### Document Chunking Strategy

```javascript
// server/vector-store/chunker.js

const CHUNK_SIZE = 1000;      // characters
const CHUNK_OVERLAP = 200;    // characters overlap between chunks

export function chunkDocument(text, options = {}) {
    const { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = options;
    const chunks = [];

    // Split by paragraphs first, then combine/split to target size
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
        if (currentChunk.length + para.length > chunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                // Keep overlap from end of previous chunk
                currentChunk = currentChunk.slice(-overlap) + '\n\n' + para;
            } else {
                // Single paragraph exceeds chunk size, split it
                chunks.push(para.slice(0, chunkSize));
                currentChunk = para.slice(chunkSize - overlap);
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}
```

---

## Integration Points

### 1. Server Startup (server.js)

```javascript
import { initVectorStore } from './server/vector-store/index.js';

// Initialize vector store before starting server
await initVectorStore('./data/knowledge.db');

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Vector store: ./data/knowledge.db`);
});
```

### 2. File Upload (server/routes/content.js)

```javascript
import { storeDocument, semanticSearch } from '../vector-store/index.js';

// After extracting text from uploaded file:
const docId = await storeDocument({
    filename: file.originalname,
    text: extractedText,
    clientName: req.body.clientName,    // Optional
    projectName: req.body.projectName,  // Optional
});

// Before generating content, search for relevant context:
const relevantChunks = await semanticSearch(userPrompt, {
    limit: 10,
    clientName: req.body.clientName,
});

// Inject relevant context into LLM prompt
const enrichedPrompt = `
## Relevant Context from Knowledge Base:
${relevantChunks.map(c => c.chunk_text).join('\n\n---\n\n')}

## User Request:
${userPrompt}
`;
```

### 3. Session Persistence (server/routes/content.js)

```javascript
import { storeSession, getSessionHistory } from '../vector-store/index.js';

// After generating content:
await storeSession({
    id: sessionId,
    prompt: userPrompt,
    contentType: 'roadmap',  // or 'slides', 'document'
    generatedContent: JSON.stringify(result),
    metadata: { clientName, projectName }
});

// Retrieve past work for context:
const pastSessions = await getSessionHistory({
    clientName: req.body.clientName,
    limit: 5
});
```

---

## Configuration Updates

### server/config.js

```javascript
export const CONFIG = {
    // ... existing config ...

    VECTOR_STORE: {
        DB_PATH: process.env.VECTOR_DB_PATH || './data/knowledge.db',
        CHUNK_SIZE: 1000,
        CHUNK_OVERLAP: 200,
        EMBEDDING_MODEL: 'text-embedding-004',
        EMBEDDING_DIMENSIONS: 768,
        SEARCH_LIMIT_DEFAULT: 10,
        MIN_SIMILARITY_SCORE: 0.7,
    },
};
```

### Environment Variables

```bash
# .env (optional overrides)
VECTOR_DB_PATH=./data/knowledge.db
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1)
- [ ] Create `server/vector-store/` directory structure
- [ ] Implement `database.js` with schema creation
- [ ] Implement `chunker.js` for document splitting
- [ ] Implement `embeddings.js` using Gemini API
- [ ] Implement `search.js` for vector similarity
- [ ] Create `index.js` public API
- [ ] Add `better-sqlite3` and `sqlite-vec` dependencies
- [ ] Update `server.js` to initialize vector store

### Phase 2: Integration (Day 2)
- [ ] Modify `server/routes/content.js` to store uploaded documents
- [ ] Add semantic search before content generation
- [ ] Inject retrieved context into prompts
- [ ] Add session persistence after generation
- [ ] Update config.js with vector store settings

### Phase 3: Enhanced Features (Day 3)
- [ ] Add client/project filtering to searches
- [ ] Implement session history retrieval
- [ ] Add document management endpoints (list, delete)
- [ ] Create backup utility (copy .db file)
- [ ] Add migration support for schema updates

### Phase 4: Testing & Validation (Day 4)
- [ ] Unit tests for chunking logic
- [ ] Integration tests for storage/retrieval
- [ ] Performance testing with large documents
- [ ] Validate embedding quality with sample queries
- [ ] Test persistence across server restarts

---

## Usage Example

### Complete Flow

```javascript
// 1. User uploads client meeting notes
POST /api/content/generate
{
    "files": [meeting_notes.docx],
    "clientName": "Acme Corp",
    "projectName": "Digital Transformation",
    "prompt": "Create a project roadmap based on these meeting notes",
    "contentType": "roadmap"
}

// 2. System processes:
//    a. Extract text from DOCX
//    b. Chunk into ~1000 char segments
//    c. Generate embeddings for each chunk
//    d. Store in knowledge.db with metadata
//    e. Search for relevant past context
//    f. Generate roadmap with enriched prompt
//    g. Store session for future reference

// 3. Future request benefits from accumulated knowledge:
POST /api/content/generate
{
    "prompt": "What were the key priorities from our Acme meetings?",
    "clientName": "Acme Corp"
}
// System retrieves relevant chunks from all Acme documents
// Returns contextually-aware response
```

---

## Security & Confidentiality

### Data Protection
| Concern | Mitigation |
|---------|------------|
| Data at rest | SQLite file on local drive only |
| Data in transit | Embeddings sent to Gemini API (can switch to local model) |
| Access control | File system permissions on knowledge.db |
| Backup security | Encrypted backup recommended for .db file |

### Future Enhancement: Fully Offline
To eliminate ALL external API calls:
1. Replace Gemini embeddings with local model (e.g., `all-MiniLM-L6-v2`)
2. Replace Gemini generation with Ollama (Llama 3.1, Mistral)
3. Result: Zero data leaves the machine

---

## Future Migration Path

### To Azure (When Budget Allows)

```
Current (Free)              →    Future (Azure)
─────────────────────────────────────────────────
SQLite + sqlite-vec         →    Azure Cosmos DB + vector search
                                 OR Azure PostgreSQL + pgvector

Gemini API (free)           →    Azure OpenAI (GPT-4)

Local file storage          →    Azure Blob Storage

Railway / Local             →    Azure App Service
```

The vector store abstraction (`server/vector-store/index.js`) makes this migration straightforward — only `database.js` needs to change; all other code remains the same.

---

## File Locations Summary

```
C:\FORCE\
├── data\
│   └── knowledge.db              # Vector database (created automatically)
├── server\
│   ├── vector-store\
│   │   ├── index.js              # Public API exports
│   │   ├── database.js           # SQLite connection & queries
│   │   ├── embeddings.js         # Gemini embedding calls
│   │   ├── chunker.js            # Text splitting logic
│   │   └── search.js             # Vector similarity search
│   ├── config.js                 # Add VECTOR_STORE config
│   └── routes\
│       └── content.js            # Integrate vector storage
├── server.js                     # Initialize vector store on startup
└── package.json                  # Add better-sqlite3, sqlite-vec
```

---

## Validation Checklist

Before implementation, confirm:

- [ ] Node.js 18+ installed (required for better-sqlite3)
- [ ] C:\FORCE\data\ directory can be created
- [ ] Gemini API key has embedding access (text-embedding-004)
- [ ] Understand that embeddings DO go to Gemini API (text only, not full docs)
- [ ] Backup strategy for knowledge.db file
- [ ] Agree with chunking strategy (1000 chars, 200 overlap)

---

## Questions to Resolve

1. **Client/Project Organization**: Should documents be strictly isolated by client, or allow cross-client knowledge sharing?

2. **Embedding API**: Accept Gemini for embeddings (free, but data leaves machine), or require fully local embedding model?

3. **Retention Policy**: How long to keep session history? Auto-delete after X days?

4. **Backup Automation**: Manual backup (copy file) or automated scheduled backups?

---

## Appendix: Alternative Embedding Models (Fully Local)

If Gemini embeddings are not acceptable for confidentiality:

| Model | Dimensions | Quality | Speed | Memory |
|-------|------------|---------|-------|--------|
| all-MiniLM-L6-v2 | 384 | Good | Fast | ~100MB |
| all-mpnet-base-v2 | 768 | Better | Medium | ~400MB |
| bge-large-en-v1.5 | 1024 | Best | Slow | ~1.3GB |

Implementation would use `@xenova/transformers` (ONNX runtime for Node.js):

```javascript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const embedding = await embedder(text, { pooling: 'mean', normalize: true });
```

This runs entirely locally — zero API calls.

---

*Document created: 2024*
*For validation in new chat session*
