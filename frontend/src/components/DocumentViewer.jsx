import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, BookOpen } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Renders the document page by page. `jumpTarget` is
 * { page, excerpt } set when the user clicks a citation elsewhere in the
 * UI — this component scrolls to that page and highlights the matching
 * text so a citation is something the user can actually go verify,
 * not just a printed page number.
 */
export default function DocumentViewer({ fileName, pages, jumpTarget }) {
  const pageRefs = useRef({});
  const [selection, setSelection] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!jumpTarget) return;
    const el = pageRefs.current[jumpTarget.page];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [jumpTarget]);

  useEffect(() => {
    function handleSelection() {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 10) {
        // Only trigger if selection is inside the viewer
        if (viewerRef.current && viewerRef.current.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const viewerRect = viewerRef.current.getBoundingClientRect();
          
          setSelection({
            text: sel.toString().trim(),
            top: rect.bottom - viewerRect.top + viewerRef.current.scrollTop + 10,
            left: rect.left - viewerRect.left + (rect.width / 2)
          });
          return;
        }
      }
      if (!explanation && !loading) {
        setSelection(null);
      }
    }
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, [explanation, loading]);

  async function handleSimplify() {
    if (!selection) return;
    setLoading(true);
    setExplanation(null);
    try {
      const res = await fetch(`${API_BASE}/api/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selection.text, language: document.getElementById('lang-select')?.value || 'English' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to simplify.");
      setExplanation(data.simpleExplanation);
    } catch (err) {
      setExplanation("Could not simplify this text. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function closeExplanation() {
    setExplanation(null);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div className="doc-pane" ref={viewerRef} style={{ position: "relative" }}>
      <div className="doc-pane-header">
        <h2>
          <FileText size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} aria-hidden="true" />
          {fileName || "Document"}
        </h2>
      </div>
      <div className="doc-pane-body" aria-label="Original document text">
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            className="doc-page"
            ref={(el) => (pageRefs.current[page.pageNumber] = el)}
          >
            <div className="doc-page-label">Page {page.pageNumber}</div>
            <div className="doc-page-text">
              {renderPageText(page.text, jumpTarget?.page === page.pageNumber ? jumpTarget.excerpt : null)}
            </div>
          </div>
        ))}
      </div>

      {selection && !explanation && (
        <button
          className="explain-btn"
          onClick={handleSimplify}
          disabled={loading}
          style={{
            position: "absolute",
            top: selection.top,
            left: selection.left,
            transform: "translateX(-50%)",
            background: "var(--accent-color, #4f46e5)",
            color: "white",
            border: "none",
            borderRadius: "16px",
            padding: "8px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            zIndex: 10,
            fontWeight: 500,
            fontSize: "14px"
          }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : <BookOpen size={16} />}
          {loading ? "Simplifying..." : "Explain it Simply"}
        </button>
      )}

      {explanation && selection && (
        <div
          className="explanation-card"
          style={{
            position: "absolute",
            top: selection.top,
            left: selection.left,
            transform: "translateX(-50%)",
            background: "var(--bg-panel, white)",
            border: "1px solid var(--border-color, #ddd)",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            width: "max-content",
            maxWidth: "320px",
            zIndex: 10,
            color: "var(--text-color, #333)",
            fontSize: "14px",
            lineHeight: "1.5"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "8px", color: "var(--accent-color, #4f46e5)" }}>
            <BookOpen size={16} /> Plain English
          </div>
          <p style={{ margin: "0 0 12px 0" }}>{explanation}</p>
          <button onClick={closeExplanation} style={{ background: "none", border: "1px solid var(--border-color)", padding: "4px 12px", borderRadius: "4px", cursor: "pointer", width: "100%" }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function renderPageText(text, highlight) {
  if (!highlight) return text;

  // Best-effort highlight: find the excerpt (or a close substring of it)
  // within the page text. Falls back to plain text if no match is found,
  // since a missed highlight is far less harmful than a wrong one.
  const needle = highlight.trim().slice(0, 120);
  const idx = text.indexOf(needle);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + needle.length)}</mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
