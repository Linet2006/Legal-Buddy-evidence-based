# Legal Buddy

An evidence-first AI assistant that explains legal documents in plain
language, in the user's own language, and shows exactly which line every
answer comes from — instead of asking the user to just trust the AI.

This is a working prototype: real document upload, a real (lightweight)
RAG pipeline, and real citations that jump to and highlight the source text
— not mock/canned chat responses.

## How it works

1. **Upload** — a PDF or TXT file is parsed on the backend, page by page.
2. **Chunk** — each page is split into overlapping text chunks, each tagged
   with its page number (`chunker.js`).
3. **Overview** — a sample of chunks is sent to an LLM via OpenRouter with
   a structured prompt to produce the First-Look Overview (parties,
   obligations, flagged provisions, missing info, a checklist).
4. **Ask** — each question triggers lightweight keyword-based retrieval
   over the chunks, and only the top-matching chunks (not the whole
   document) are sent to the model via OpenRouter's chat completions API,
   grounded by the evidence-first system prompt (`systemPrompt.js`).
5. **Verify** — every citation in the UI is clickable. Clicking it scrolls
   the original document viewer to that page and highlights the matching
   text, so a user can check the AI's claim against the source themselves.

## Project structure

```
legal-buddy/
  backend/          Express API: upload, chunking, retrieval, OpenRouter calls
    server.js
    chunker.js
    systemPrompt.js
    .env.example
  frontend/          React + Vite UI
    src/
      App.jsx
      components/
        DocumentUploader.jsx
        DocumentViewer.jsx    <- clickable citations jump here
        OverviewPanel.jsx
        ChatInterface.jsx
        ChatMessage.jsx        <- renders Answer/Evidence/What it means/Limitations/Verify
        EvidenceBadge.jsx      <- [DIRECTLY STATED] / [SUPPORTED INFERENCE] / [AMBIGUOUS] / [NOT FOUND]
      styles/index.css         <- light, calm, accessible theme (dark mode optional)
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env and add your OpenRouter key from https://openrouter.ai/keys
npm run dev
```

Runs on `http://localhost:5000` (set via `PORT` in `.env`).

Any OpenRouter model id works — set `OPENROUTER_MODEL` in `.env`. Free/cheap
options that handle structured JSON output well: `google/gemini-2.0-flash-exp:free`,
`meta-llama/llama-3.1-8b-instruct:free`, `mistralai/mistral-7b-instruct:free`.
If a model's response fails to parse as JSON, try a different one — smaller
free models occasionally add extra chatty text around the JSON.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` and proxies `/api` to `http://localhost:5000`.

Open `http://localhost:5173`, upload a sample contract, and try both the
Overview tab and the Ask a question tab.

## Design choices worth knowing about

- **Light theme by default.** Someone reading a legal notice is often
  anxious — a calm, high-contrast, generously-spaced layout was chosen
  over dark mode/glassmorphism, which is available only as an optional
  toggle.
- **Keyword retrieval, not embeddings.** Kept the pipeline free and
  dependency-light for a hackathon; swap `retrieveRelevantChunks` in
  `chunker.js` for an embedding-based retriever later without touching
  anything else.
- **Structured JSON output from the model**, not free text, so the UI can
  render Evidence, What It Means, Limitations, and Verify as distinct,
  scannable sections rather than a wall of text.
- **Prompt-injection guard** is explicit in the system prompt: document
  content is always treated as data, never as instructions.

## What to test before a demo

- A real rental agreement / job offer / loan contract (not lorem ipsum).
- A question the document doesn't answer — it should say so, not guess.
- A scanned/image-only PDF — should fail with a clear message, not crash.
- Multilingual: switch the language selector and re-ask a question.
