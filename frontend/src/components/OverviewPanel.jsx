import { AlertTriangle, CircleHelp, CheckSquare, Loader2 } from "lucide-react";

// Defensive helper: the model can occasionally return a field as a string,
// null, or omit it instead of an array. Never let a shape mismatch crash
// the whole page — coerce to an array here as a last line of defense.
function asArray(val) {
  if (Array.isArray(val)) return val;
  if (val === null || val === undefined || val === "") return [];
  return [val];
}

export default function OverviewPanel({ overview, loading, error, onJump }) {
  if (loading) {
    return (
      <div className="tab-panel">
        <div className="chat-loading">
          <Loader2 size={16} className="spin" aria-hidden="true" />
          Reading the document and building the overview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-panel">
        <div className="chat-error" role="alert">{error}</div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="tab-panel">
      <div className="overview-meta">
        <MetaItem label="Document type" value={overview.documentType} />
        <MetaItem label="Parties" value={asArray(overview.parties).join(", ")} />
        <MetaItem label="Effective date" value={overview.effectiveDate} />
        <MetaItem label="Duration" value={overview.duration} />
      </div>

      {overview.riskScore !== null && (
        <div className="overview-section risk-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center" }}>
              <AlertTriangle size={18} style={{ marginRight: 8, color: overview.riskScore > 6 ? "#ef4444" : (overview.riskScore > 3 ? "#f59e0b" : "#22c55e") }} />
              Overall Risk Score
            </h3>
            <span style={{ fontSize: "24px", fontWeight: "bold", color: overview.riskScore > 6 ? "#ef4444" : (overview.riskScore > 3 ? "#f59e0b" : "#22c55e") }}>
              {overview.riskScore} / 10
            </span>
          </div>
          {overview.riskExplanation && <p style={{ margin: 0, color: "var(--text-light)" }}>{overview.riskExplanation}</p>}
        </div>
      )}

      <EvidenceGroup title="Key obligations" items={overview.keyObligations} onJump={onJump} />
      <EvidenceGroup title="Payment terms" items={overview.paymentTerms} onJump={onJump} />
      <EvidenceGroup title="Termination" items={overview.termination} onJump={onJump} />
      <EvidenceGroup title="Deadlines" items={overview.deadlines} onJump={onJump} />
      <EvidenceGroup title="Renewal" items={overview.renewal} onJump={onJump} />
      <EvidenceGroup title="Dispute resolution" items={overview.disputeResolution} onJump={onJump} />

      {asArray(overview.provisionsRequiringAttention).length > 0 && (
        <div className="overview-section">
          <h3><AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />Risk Scanner & Red Flags</h3>
          {asArray(overview.provisionsRequiringAttention).map((item, i) => (
            <div className="attention-card" key={i}>
              <div className="attention-card-title">{item.provision}</div>
              <div className="attention-card-why">{item.whyItMatters}</div>
              <button className="page-chip" onClick={() => onJump({ page: item.page, excerpt: item.excerpt })}>
                Page {item.page} — verify
              </button>
            </div>
          ))}
        </div>
      )}

      {asArray(overview.missingOrUnclear).length > 0 && (
        <div className="overview-section">
          <h3><CircleHelp size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />What the document doesn't specify</h3>
          {asArray(overview.missingOrUnclear).map((item, i) => (
            <div className="missing-item" key={i}>• {item}</div>
          ))}
        </div>
      )}

      {asArray(overview.checklist).length > 0 && (
        <div className="overview-section">
          <h3><CheckSquare size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />Before you sign or respond</h3>
          {asArray(overview.checklist).map((item, i) => (
            <div className="checklist-item" key={i}>
              <input type="checkbox" id={`chk-${i}`} />
              <label htmlFor={`chk-${i}`}>{item}</label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="overview-meta-item">
      <div className="overview-meta-label">{label}</div>
      <div className="overview-meta-value">{value || "Not specified"}</div>
    </div>
  );
}

function EvidenceGroup({ title, items, onJump }) {
  const list = asArray(items);
  if (list.length === 0) return null;
  return (
    <div className="overview-section">
      <h3>{title}</h3>
      {list.map((item, i) => {
        const isObj = item && typeof item === "object";
        const text = isObj ? item.text ?? "" : String(item);
        const page = isObj ? item.page : null;
        return (
          <div className="evidence-list-item" key={i}>
            <button className="page-chip" onClick={() => onJump({ page, excerpt: text })}>
              {page ? `p.${page}` : "—"}
            </button>
            <span>{text}</span>
          </div>
        );
      })}
    </div>
  );
}
