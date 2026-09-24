import { useState, useRef } from "react";
import { UploadCloud, ShieldCheck, FileSearch, ListChecks, Languages } from "lucide-react";

const ACCEPTED_TYPES = ["application/pdf", "text/plain"];

export default function DocumentUploader({ onUpload, uploading, error }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      onUpload(null, "Please upload a PDF or TXT file.");
      return;
    }
    onUpload(file);
  }

  return (
    <div className="upload-view">
      <h1>Understand what you're signing, before you sign it</h1>
      <p className="subhead">
        Upload a contract, agreement, or legal notice. Legal Buddy explains it in
        plain language, and shows you exactly which line every answer comes from.
      </p>

      <div
        className={`dropzone${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={30} className="dropzone-icon" aria-hidden="true" />
        <p>Drag a PDF or text file here</p>
        <p>or</p>
        <button
          type="button"
          className="upload-button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Reading document…" : "Choose a file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          className="visually-hidden"
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="Upload legal document"
        />
      </div>

      {error && <div className="upload-error" role="alert">{error}</div>}

      <div className="use-case-list">
        <div className="use-case-item">
          <FileSearch size={16} aria-hidden="true" />
          <span>Get a plain-language overview and see clauses worth a closer look</span>
        </div>
        <div className="use-case-item">
          <ListChecks size={16} aria-hidden="true" />
          <span>Ask questions and get a checklist to bring to a lawyer or landlord</span>
        </div>
        <div className="use-case-item">
          <Languages size={16} aria-hidden="true" />
          <span>Read explanations in your own language, alongside the original text</span>
        </div>
        <div className="use-case-item">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Every answer links back to the exact line it came from — nothing is guessed</span>
        </div>
      </div>
    </div>
  );
}
