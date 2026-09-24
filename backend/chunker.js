/**
 * Splits extracted document text into overlapping chunks, each tagged
 * with the page number(s) it came from. This page tracking is what lets
 * the frontend turn a citation like "Page 3" into a real, clickable
 * jump-to-source action instead of a printed label.
 */

const CHUNK_SIZE_CHARS = 1200; // roughly 250-300 words per chunk
const CHUNK_OVERLAP_CHARS = 150;

/**
 * @param {Array<{pageNumber: number, text: string}>} pages
 * @returns {Array<{id: string, page: number, text: string, startOffset: number}>}
 */
export function chunkDocument(pages) {
  const chunks = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
      const chunkText = text.slice(start, end);

      chunks.push({
        id: `p${page.pageNumber}-c${chunkIndex}`,
        page: page.pageNumber,
        text: chunkText,
        startOffset: start,
      });

      chunkIndex += 1;
      if (end === text.length) break;
      start = end - CHUNK_OVERLAP_CHARS;
    }
  }

  return chunks;
}

/**
 * Very lightweight lexical retrieval (no embeddings needed, so it works
 * with zero extra API cost). Scores chunks by keyword overlap with the
 * query. Good enough for a hackathon-scale document; swap in a real
 * embedding-based retriever later without changing the rest of the pipeline.
 */
export function retrieveRelevantChunks(chunks, query, topK = 6) {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((chunk) => {
    const chunkTerms = tokenize(chunk.text);
    const termFreq = {};
    for (const t of chunkTerms) termFreq[t] = (termFreq[t] || 0) + 1;

    let score = 0;
    for (const qt of queryTerms) {
      if (termFreq[qt]) score += termFreq[qt];
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // If nothing scored above zero, fall back to the first chunks so the
  // model still has document context rather than nothing at all.
  const withHits = scored.filter((s) => s.score > 0);
  const pool = withHits.length > 0 ? withHits : scored;

  return pool.slice(0, topK).map((s) => s.chunk);
}

function tokenize(text) {
  const stopwords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "of", "to", "and", "or",
    "in", "on", "for", "this", "that", "it", "does", "do", "what", "when",
    "how", "can", "my", "i", "be", "with", "as", "by", "if", "not",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}
