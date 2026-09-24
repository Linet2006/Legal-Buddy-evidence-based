import EvidenceBadge from "./EvidenceBadge.jsx";

export default function ChatMessage({ turn, onJump }) {
  if (turn.role === "question") {
    return <div className="chat-turn-question">{turn.text}</div>;
  }

  if (turn.role === "error") {
    return <div className="chat-error" role="alert">{turn.text}</div>;
  }

  const { answer, evidence, whatItMeans, limitations, verify } = turn.data;

  return (
    <div className="chat-answer-card">
      <div className="chat-answer-main">{answer}</div>

      {evidence?.length > 0 && (
        <div className="chat-answer-section">
          <h4>Evidence</h4>
          {evidence.map((e, i) => (
            <div className="evidence-excerpt" key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EvidenceBadge label={e.label} />
                <button
                  className="page-chip"
                  onClick={() => onJump({ page: e.page, excerpt: e.excerpt })}
                >
                  Page {e.page} — verify
                </button>
              </div>
              <div className="evidence-excerpt-text">"{e.excerpt}"</div>
            </div>
          ))}
        </div>
      )}

      {whatItMeans && (
        <div className="chat-answer-section">
          <h4>What it means</h4>
          <p className="limitations-text">{whatItMeans}</p>
        </div>
      )}

      {limitations && (
        <div className="chat-answer-section">
          <h4>Limitations</h4>
          <p className="limitations-text">{limitations}</p>
        </div>
      )}

      {verify && (
        <div className="chat-answer-section">
          <h4>Verify this yourself</h4>
          <p className="verify-text">{verify}</p>
        </div>
      )}
    </div>
  );
}
