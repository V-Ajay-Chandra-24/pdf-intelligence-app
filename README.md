# PDF Intelligence

An AI-powered PDF workspace where users can upload documents, get automatic AI-generated summaries, chat with their PDFs using natural language, and collaborate with others through secure sharing and threaded comments.

**Live app:** https://pdf-intelligence-app-production.up.railway.app/

**Video walkthrough:** https://www.loom.com/share/f3d0459c930c453b88b82018ef0b85d5

---

## Features

### Core
- **Authentication** — email/password (bcrypt-hashed) and Google OAuth via NextAuth
- **File upload** — PDF validation, real-time upload progress, automatic text extraction
- **Dashboard** — search by filename, view AI summaries inline, upload dialog with live progress
- **AI summarization** — automatic 3–5 sentence summaries generated on upload
- **AI chat** — ask natural-language questions about a document, grounded in its actual content, with streaming responses and multi-turn conversation memory
- **Sharing** — generate a unique, revocable link so anyone can view a PDF without an account
- **Guest access** — invited users can view, chat, and comment without signing up
- **Comments** — threaded replies and basic rich-text formatting (bold, italic, bullet points)
- **Access control** — every document, comment, and chat thread is authorized at the query level, not just hidden in the UI

### AI capabilities in detail

**Summarization**
On upload, extracted text is sent to the configured LLM with a system prompt constrained to 3–5 sentences of concrete, specific content (names, dates, figures) rather than generic restatement ("this document is about..."). A server-side safety net strips any leftover preamble the model might still produce.

**Chat**
The chat interface streams responses token-by-token and keeps the last 5 conversation turns (10 messages) per participant, persisted server-side so history survives a page refresh. Answers are grounded — the model is instructed to say "I couldn't find that in the document" rather than guess when an answer isn't present in the given context.

**Handling long documents (hybrid context strategy)**
Because a PDF's full text can exceed a model's context window, the app uses two strategies depending on document length, switched automatically based on an estimated token count:

- **Full-context mode** (default for most documents): the entire extracted text is passed directly in the prompt. This gives the model perfect global context and avoids retrieval misses. The token threshold for this mode is configurable per LLM provider, since context window sizes differ significantly between providers.
- **RAG mode** (for documents exceeding the threshold): the text is chunked (~500–800 tokens per chunk, ~100 token overlap), embedded, and stored in Postgres using the `pgvector` extension. Each chat question is embedded and compared against stored chunks using cosine similarity (`embedding <=> query`), and only the top-matching chunks are used as context. Retrieval is always scoped to a single `documentId`, so chunks from one document can never leak into another document's chat — this was verified by testing cross-document questions to confirm no answer bleed-through.

This hybrid approach was chosen over pure full-context (which doesn't scale to very large documents) or pure RAG (which can miss relevant details on shorter documents where full context would be strictly better and cheaper).

**Text extraction**
PDF text is extracted using `unpdf` (built on PDF.js). For densely tabular documents (receipts, mark sheets, forms), extraction uses positional (x/y) text data to reconstruct rows, rather than relying on flattened text order — this avoids a failure mode where labels and values become mismatched when a table is read out of visual order. An OCR fallback handles scanned/image-based PDFs that have no extractable text layer.

**Multi-provider LLM support**
The app supports both Google Gemini and a local Ollama instance as interchangeable LLM providers, selected via the `LLM_PROVIDER` environment variable, behind a shared provider interface (`summarize()`, `chat()`). This made it possible to develop and test entirely offline with a local model before switching to Gemini for deployment, without changing any calling code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Database | PostgreSQL (via [Neon](https://neon.tech)) |
| ORM | Prisma |
| Vector search | `pgvector` extension |
| Auth | NextAuth (credentials + Google OAuth) |
| LLM (production) | Google Gemini (`gemini-3.6-flash` for chat/summarization, `gemini-embedding-001` for embeddings) |
| LLM (local/offline) | Ollama (`gemma3:4b` + `nomic-embed-text`) |
| PDF text extraction | `unpdf` (PDF.js) with positional-text table handling |
| Deployment | [Railway](https://railway.app) |
| Styling | Tailwind CSS |

---

## Architecture notes

- **Provider abstraction:** `lib/llm/index.ts` exposes a single interface regardless of which LLM backend is active, selected at request time via `LLM_PROVIDER`. This avoids caching the provider choice at module load, which previously caused the app to silently keep using Ollama even after switching to Gemini — the fix was to resolve the provider dynamically on every call rather than once at startup.
- **RAG isolation:** every `DocumentChunk` row is tagged with its `documentId`, and every similarity search filters by `documentId` before ranking by vector distance, so retrieval is always scoped to a single document.
- **Chat history isolation:** chat messages are scoped by both `documentId` and a `participantKey` (the authenticated user's ID, or a persistent per-guest session ID), so the document owner and every individual guest each have their own private conversation with the AI — no cross-visibility between different viewers of the same shared document.
- **Share links:** generated using a cryptographically random token (not a sequential or guessable ID), and can be revoked at any time by the owner. Revocation is enforced server-side on every request (document access, chat, comments), not just at the initial page load.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the following:

```bash
# Database (PostgreSQL connection string — must support the `vector` extension)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"          # your deployed URL in production
NEXTAUTH_SECRET="generate with: openssl rand -base64 32"

# Google OAuth (from Google Cloud Console → APIs & Services → Credentials)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# LLM provider toggle — "gemini" or "ollama"
LLM_PROVIDER="gemini"

# Google Gemini (required if LLM_PROVIDER=gemini)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_CHAT_MODEL="gemini-3.6-flash"
GEMINI_EMBED_MODEL="gemini-embedding-001"

# Ollama (required if LLM_PROVIDER=ollama; for local/offline development only)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="gemma3:4b"

# Hybrid context thresholds (approximate tokens; full-context below, RAG above)
FULL_CONTEXT_TOKEN_THRESHOLD_OLLAMA="5000"
FULL_CONTEXT_TOKEN_THRESHOLD_GEMINI="800000"
```

**Security notes:**
- `GEMINI_API_KEY`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `DATABASE_URL` must never be committed to the repository or exposed to client-side code. `.env` is listed in `.gitignore`.
- If you're setting up billing on the Gemini API project for higher rate limits, note that enabling billing removes that project's free-tier allowance entirely going forward.

---

## Running Locally

### Prerequisites
- Node.js 20+
- A PostgreSQL database with the `pgvector` extension available (a free [Neon](https://neon.tech) project works well, or run Postgres locally/via Docker)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (or a local [Ollama](https://ollama.com) install if you'd rather run fully offline)

### Setup

1. **Clone the repo and install dependencies**
   ```bash
   git clone https://github.com/your-username/pdf-intelligence-app.git
   cd pdf-intelligence-app
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in the values as described above.

3. **Enable the `pgvector` extension** on your database (run once, via your database's SQL console):
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

5. **(Optional) Run with Ollama instead of Gemini**, for fully offline development:
   ```bash
   ollama pull gemma3:4b
   ollama pull nomic-embed-text
   ```
   Set `LLM_PROVIDER="ollama"` in `.env`.

6. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

### Running with Docker (optional)

A `Dockerfile` and `docker-compose.yml` are included for containerized local development:

```bash
docker compose up --build
```

If running Ollama natively on the host machine (rather than as a container), set `OLLAMA_BASE_URL="http://host.docker.internal:11434"` so the containerized app can reach it.

---

## Known Limitations

- The Gemini free tier has daily/per-minute request limits; heavy testing may require enabling billing on the associated Google Cloud project for uninterrupted use.

---

## Deployment

The production app is deployed on [Railway](https://railway.app), using:
- **Database:** [Neon](https://neon.tech) (managed Postgres with `pgvector` support)
- **LLM:** Google Gemini API

To deploy your own instance:
1. Push the repo to GitHub.
2. Create a new Railway project from the GitHub repo — Railway will build from the included `Dockerfile` automatically.
3. Add all environment variables listed above in Railway's Variables tab.
4. Generate a public domain under Settings → Networking, then set `NEXTAUTH_URL` to that domain and redeploy.
5. Add the deployed domain to your Google OAuth client's Authorized JavaScript origins and Authorized redirect URIs (`https://your-domain/api/auth/callback/google`).