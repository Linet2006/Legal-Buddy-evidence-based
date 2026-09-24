import { useState } from "react";
import { ShieldCheck, Moon, Sun } from "lucide-react";
import DocumentUploader from "./components/DocumentUploader.jsx";
import DocumentViewer from "./components/DocumentViewer.jsx";
import OverviewPanel from "./components/OverviewPanel.jsx";
import ChatInterface from "./components/ChatInterface.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Hindi", label: "हिंदी" },
  { code: "Kannada", label: "ಕನ್ನಡ" },
  { code: "Tamil", label: "தமிழ்" },
  { code: "Telugu", label: "తెలుగు" },
];

export default function App() {
  const [session, setSession] = useState(null); // { sessionId, fileName, pages }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [language, setLanguage] = useState("English");
  const [dark, setDark] = useState(false);

  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);

  const [chatTurns, setChatTurns] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [jumpTarget, setJumpTarget] = useState(null);

  function toggleDark() {
    setDark((d) => {
      document.body.classList.toggle("dark", !d);
      return !d;
    });
  }

  async function handleUpload(file, forcedError) {
    if (forcedError) {
      setUploadError(forcedError);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("document", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      const docRes = await fetch(`/api/document/${data.sessionId}`);
      const docData = await docRes.json();

      setSession({ sessionId: data.sessionId, fileName: data.fileName, pages: docData.pages });
      loadOverview(data.sessionId);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function loadOverview(sessionId) {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build overview.");
      setOverview(data);
    } catch (err) {
      setOverviewError(err.message);
    } finally {
      setOverviewLoading(false);
    }
  }

  async function handleAsk(question) {
    setChatTurns((t) => [...t, { role: "question", text: question }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, question, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get an answer.");
      setChatTurns((t) => [...t, { role: "answer", data }]);
    } catch (err) {
      setChatTurns((t) => [...t, { role: "error", text: err.message }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">Legal Buddy</span>
          <span className="brand-tag">evidence-first document assistant</span>
        </div>
        <div className="header-controls">
          <label htmlFor="lang-select" className="visually-hidden">Response language</label>
          <select
            id="lang-select"
            className="lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button className="theme-toggle" onClick={toggleDark} aria-pressed={dark}>
            {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <div className="disclaimer-bar">
        <ShieldCheck size={14} aria-hidden="true" />
        Legal Buddy explains documents; it isn't a lawyer and doesn't give legal advice. For high-stakes decisions, consult a qualified legal professional.
      </div>

      <div className="app-body">
        {!session ? (
          <DocumentUploader onUpload={handleUpload} uploading={uploading} error={uploadError} />
        ) : (
          <div className="workspace">
            <DocumentViewer fileName={session.fileName} pages={session.pages} jumpTarget={jumpTarget} />

            <div className="right-pane">
              <div className="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === "overview"}
                  className={`tab${activeTab === "overview" ? " active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "chat"}
                  className={`tab${activeTab === "chat" ? " active" : ""}`}
                  onClick={() => setActiveTab("chat")}
                >
                  Ask a question
                </button>
              </div>

              <ErrorBoundary key={activeTab}>
                {activeTab === "overview" ? (
                  <OverviewPanel
                    overview={overview}
                    loading={overviewLoading}
                    error={overviewError}
                    onJump={setJumpTarget}
                  />
                ) : (
                  <ChatInterface
                    turns={chatTurns}
                    onAsk={handleAsk}
                    loading={chatLoading}
                    onJump={setJumpTarget}
                  />
                )}
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
