import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";

/**
 * Renders the document page by page. `jumpTarget` is
 * { page, excerpt } set when the user clicks a citation elsewhere in the
 * UI — this component scrolls to that page and highlights the matching
 * text so a citation is something the user can actually go verify,
 * not just a printed page number.
 */
export default function DocumentViewer({ fileName, pages, jumpTarget }) {
  const pageRefs = useRef({});

  useEffect(() => {
    if (!jumpTarget) return;
    const el = pageRefs.current[jumpTarget.page];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [jumpTarget]);

  return (
    <div className="doc-pane">
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
