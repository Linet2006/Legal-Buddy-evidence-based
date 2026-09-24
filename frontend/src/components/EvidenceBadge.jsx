const LABEL_CONFIG = {
  "DIRECTLY STATED": { className: "stated", text: "Directly stated" },
  "SUPPORTED INFERENCE": { className: "inference", text: "Inferred" },
  AMBIGUOUS: { className: "ambiguous", text: "Ambiguous" },
  "NOT FOUND": { className: "notfound", text: "Not found" },
};

export default function EvidenceBadge({ label }) {
  const config = LABEL_CONFIG[label] || { className: "notfound", text: label };
  return <span className={`evidence-badge ${config.className}`}>{config.text}</span>;
}
