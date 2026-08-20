# PDF Intelligence & Collaboration System

This is a foundational backend and frontend slice for a Next.js (App Router) application focusing on User Authentication, PDF File Upload, and Adaptive PDF Text Extraction.

## Features
- **User Authentication:** Registration and Login via NextAuth (Credentials).
- **PDF Upload:** Dropzone with strict MIME-type and size validation.
- **Adaptive Extraction Pipeline:**
  - **Primary Pass:** Extracts digital text using `pdf-parse`.
  - **OCR Fallback:** Automatically detects scanned PDFs (unreadable text) and performs OCR using `pdf2pic` (Ghostscript + GraphicsMagick) and `tesseract.js`.
- **Database:** Prisma ORM with PostgreSQL.

## Prerequisites for Local Development (Windows/Mac/Linux)
If you want to run this locally **without Docker**, you must install the following native dependencies for the OCR fallback to work:
1.  **Ghostscript** (added to system PATH)
2.  **GraphicsMagick** (added to system PATH)

## Local Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file based on `.env.example`.
3. Push the Prisma schema to your database:
   ```bash
   npx prisma db push
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Docker Deployment (Recommended for Servers)
To avoid installing Ghostscript and GraphicsMagick on your host server, use Docker. This containerizes the application along with all system dependencies.

1. Create your `.env` file.
2. Build and run the containers using Docker Compose:
   ```bash
   docker-compose up --build -d
   ```
3. The app will be available at `http://localhost:3000`. The uploads will be persisted in `./public/uploads`.

## Hybrid Context Strategy & AI Chat
The PDF viewer includes an AI-powered chat interface to ask questions about your documents, implemented with a hybrid context strategy:

1. **Full-Context Mode (< 5000 tokens):** If the extracted text is short enough, the entire document is passed inside the system prompt on every turn. No chunking or embedding needed.
2. **RAG Mode (> 5000 tokens):** Large documents are automatically chunked (~500-800 tokens, 100 overlap) and embedded using the `nomic-embed-text` model. The embeddings are stored in PostgreSQL using the `pgvector` extension. On every user question, the system runs a Cosine Similarity search (`<=>`) scoped strictly to that `documentId` to pull the top 6 most relevant chunks.

**Why this approach?**
Passing a 100-page PDF directly into a local model like `gemma3:4b` would overflow its context window and crash. Pure RAG, however, is often overkill (and loses global context) for a 2-page memo. This hybrid approach strikes the best balance of context retention and performance.

**Swapping to Gemini:**
To swap Ollama for Google Gemini, update your `.env` file to set `LLM_PROVIDER="gemini"` and provide your `GEMINI_API_KEY`. The system will automatically route chat, summarization, and RAG embeddings to Gemini using the `@google/genai` SDK.

> [!WARNING]
> **Embedding Compatibility:** Embeddings from `nomic-embed-text` (Ollama) and `gemini-embedding-001` (Gemini) exist in entirely different vector spaces, even though both are 768 dimensions. When switching your `LLM_PROVIDER`, you MUST run `npm run clear-embeddings` to wipe out the old provider's vectors. The system will automatically re-embed the documents using the new provider upon the next chat query.

## File Sharing & Guest Access

Document owners can securely share PDFs with unauthenticated guests using a cryptographically secure token system.

### Share Model & Revocation
- **Link Generation:** Owners can generate a unique `crypto.randomUUID()` based share link (`/shared/[token]`).
- **Revocation:** Owners can revoke a link at any time. Revocation immediately sets `revokedAt` on the `Share` record. Any API requests using that token will fail gracefully with a "Revoked" message. The owner can then generate a new link, ensuring the old one remains permanently unusable.

### Guest Identity & Comments
- Guests visiting a shared link can view the PDF, use the AI Chat, and interact with the **Comments Sidebar**.
- **Identity:** On their first attempt to comment, guests are prompted for a Display Name. This is stored in `localStorage` scoped to the share token, allowing consistent attribution without requiring an account.
- **Permissions:** 
  - Guests can post comments and delete their *own* comments.
  - Guests *cannot* revoke links, delete the document, or access the dashboard.
  - Owners can visually distinguish their own comments from guest comments.

### AI Chat Access & Security
To prevent abuse of the unauthenticated AI Chat endpoint, a strict permission boundary is enforced server-side. The `verifyDocumentAccess` helper ensures the chat API rejects requests missing either a valid owner session or a valid, non-revoked share token. Additionally, guest chat requests are scoped to a basic in-memory rate limit (e.g., max 5 messages per minute) to prevent free LLM usage exploitation.
