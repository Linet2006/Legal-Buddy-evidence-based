import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { chunkDocument, retrieveRelevantChunks } from "./chunker.js";
import { SYSTEM_PROMPT, buildUserPrompt, buildOverviewPrompt, buildSimplifyPrompt } from "./systemPrompt.js";

const app = express();

// Efficiency: Compress response bodies to reduce payload size
app.use(compression());

// Security: Helmet adds secure HTTP headers (e.g. anti-XSS, anti-clickjacking)
app.use(helmet());

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Security: Rate limiting to prevent brute-force or DoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later." }
});
app.use("/api/", limiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB cap
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PDF or TXT files are accepted."));
    }
    cb(null, true);
  },
});

// In-memory session store.
const sessions = new Map();

// Efficiency/Memory Management: Clean up old sessions every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Calls OpenRouter's OpenAI-compatible chat completions endpoint with the
 * evidence-first system prompt plus a grounded user prompt, and returns
 * the parsed JSON the model was instructed to produce.
 */
async function callModel(userPrompt) {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to backend/.env (see .env.example)."
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Optional attribution headers OpenRouter recommends — safe to omit.
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Legal Buddy",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      // Forces JSON-only output where the selected model supports it.
      // With model = "openrouter/free", this also tells the router to
      // only pick free models capable of structured output, avoiding
      // free-tier models that ignore "respond with only JSON" as a
      // plain instruction and prepend chatty/safety-label text instead.
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${errBody.slice(0, 300)}`);
  }

  let rawText = "";
  try {
    const responseText = await response.text();
    const data = JSON.parse(responseText);
    
    if (data.error) {
      throw new Error(`OpenRouter API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    rawText = data.choices?.[0]?.message?.content;
  } catch (parseErr) {
    throw new Error(
      parseErr.message.includes("OpenRouter API Error") 
        ? parseErr.message 
        : "The free AI server (OpenRouter) returned an empty or invalid response. This happens when their servers are overloaded. Please click the button to try again."
    );
  }

  if (!rawText) {
    throw new Error("OpenRouter returned an empty response. Please try clicking the tab again.");
  }

  return parseModelJson(rawText);
}

function parseModelJson(rawText) {
  // Models sometimes wrap JSON in fences, or add stray text, despite
  // instructions — strip fences and extract the outermost {...} block.
  let cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Free models often fail to output strict JSON. Instead of crashing,
    // gracefully wrap whatever text they did output into our expected shape!
    console.warn("Failed to parse JSON, returning raw text as fallback.");
    let fallbackText = rawText.replace(/^```json/i, "").replace(/```/g, "").trim();
    
    // If the model dumped a safety rating or generic error instead of an answer
    if (fallbackText.toLowerCase().includes("user safety") || fallbackText.toLowerCase().includes("i cannot answer")) {
      fallbackText = "This information is not provided in the document.";
    }

    return {
      answer: fallbackText,
      evidence: [],
      whatItMeans: fallbackText === "This information is not provided in the document." 
        ? "The AI correctly identified that this topic is missing." 
        : "Note: The free AI model struggled to format this answer correctly, but the raw text is shown above.",
      limitations: "",
      verify: "Please verify by reading the document directly."
    };
  }
}

// ---- Upload & extract -------------------------------------------------

app.post("/api/upload", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    let pages;
    if (req.file.mimetype === "application/pdf") {
      pages = await extractPdfPages(req.file.buffer);
    } else {
      // Plain text: treat the whole file as one "page".
      pages = [{ pageNumber: 1, text: req.file.buffer.toString("utf-8") }];
    }

    const nonEmptyPages = pages.filter((p) => p.text.trim().length > 0);
    if (nonEmptyPages.length === 0) {
      return res.status(422).json({
        error:
          "No extractable text found. This may be a scanned/image-only PDF — try a text-based PDF or TXT file.",
      });
    }

    const chunks = chunkDocument(nonEmptyPages);
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(sessionId, {
      fileName: req.file.originalname,
      pages: nonEmptyPages,
      chunks,
      createdAt: Date.now(),
    });

    res.json({
      sessionId,
      fileName: req.file.originalname,
      pageCount: nonEmptyPages.length,
      chunkCount: chunks.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to process document." });
  }
});

async function extractPdfPages(buffer) {
  const pages = [];
  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((item) => item.str).join(" ");
      pages.push({ pageNumber: pages.length + 1, text });
      return text;
    },
  });
  return pages;
}

// ---- Overview -----------------------------------------------------------

app.post("/api/overview", async (req, res) => {
  try {
    const { sessionId, language } = req.body;
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found. Upload the document again." });

    // Use a broad sample of chunks for the overview (first N + evenly spaced).
    const chunks = sampleChunksForOverview(session.chunks);
    const prompt = buildOverviewPrompt({ chunks, language });
    const parsed = await callModel(prompt);

    res.json(normalizeOverview(parsed));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate overview." });
  }
});

/**
 * Free-tier models don't always return the exact shape the prompt asked
 * for (a field meant to be an array sometimes comes back as a string,
 * null, or missing entirely). Coerce everything to the shape the
 * frontend expects so one inconsistent field can never crash the whole
 * Overview page.
 */
function normalizeOverview(raw) {
  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (val === null || val === undefined || val === "") return [];
    return [val]; // wrap a stray string/object as a single-item array
  };

  const toStringArray = (val) =>
    toArray(val).map((item) => (typeof item === "string" ? item : JSON.stringify(item)));

  const toEvidenceArray = (val) =>
    toArray(val).map((item) => {
      if (item && typeof item === "object") {
        return { text: item.text ?? "", page: item.page ?? null };
      }
      return { text: String(item), page: null };
    });

  return {
    documentType: raw?.documentType ?? null,
    parties: toStringArray(raw?.parties),
    effectiveDate: raw?.effectiveDate ?? null,
    duration: raw?.duration ?? null,
    keyObligations: toEvidenceArray(raw?.keyObligations),
    paymentTerms: toEvidenceArray(raw?.paymentTerms),
    termination: toEvidenceArray(raw?.termination),
    deadlines: toEvidenceArray(raw?.deadlines),
    renewal: toEvidenceArray(raw?.renewal),
    disputeResolution: toEvidenceArray(raw?.disputeResolution),
    provisionsRequiringAttention: toArray(raw?.provisionsRequiringAttention).map((item) => ({
      provision: item?.provision ?? String(item ?? ""),
      whyItMatters: item?.whyItMatters ?? "",
      page: item?.page ?? null,
      excerpt: item?.excerpt ?? "",
    })),
    missingOrUnclear: toStringArray(raw?.missingOrUnclear),
    checklist: toStringArray(raw?.checklist),
    riskScore: typeof raw?.riskScore === "number" ? raw.riskScore : null,
    riskExplanation: raw?.riskExplanation || "",
  };
}

function sampleChunksForOverview(chunks, maxChunks = 24) {
  if (chunks.length <= maxChunks) return chunks;
  const step = chunks.length / maxChunks;
  const sampled = [];
  for (let i = 0; i < maxChunks; i++) {
    sampled.push(chunks[Math.floor(i * step)]);
  }
  return sampled;
}

// ---- Chat / Q&A -----------------------------------------------------------

app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, question, language } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found. Upload the document again." });

    const relevant = retrieveRelevantChunks(session.chunks, question, 6);
    const prompt = buildUserPrompt({ question, chunks: relevant, language });
    const parsed = await callModel(prompt);

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate a response." });
  }
});

// ---- Simplify -----------------------------------------------------------

app.post("/api/simplify", async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required to simplify." });
    }
    
    // We don't necessarily need a session ID here, it's just raw text to simplify
    const prompt = buildSimplifyPrompt({ text, language });
    const parsed = await callModel(prompt);
    
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to simplify text." });
  }
});

// ---- Document text (for the viewer pane) -----------------------------

app.get("/api/document/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found." });
  res.json({
    fileName: session.fileName,
    pages: session.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, openRouterConfigured: Boolean(OPENROUTER_API_KEY), model: OPENROUTER_MODEL });
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Legal Buddy backend running on http://localhost:${PORT}`);
  if (!OPENROUTER_API_KEY) {
    console.warn(
      "WARNING: OPENROUTER_API_KEY not set. Copy .env.example to .env and add your key from https://openrouter.ai/keys"
    );
  }
});
