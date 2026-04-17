function safeDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

export default function DecisionCard({ log }) {
  const item = log || {};

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #374151",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "8px" }}>
        {item.category || "Uncategorized"}
      </div>

      <div style={{ marginBottom: "8px" }}>
        {item.decision_text || "No decision text provided."}
      </div>

      <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "6px" }}>
        Policy: {item.policy_referenced || "None"}
      </div>

      <div style={{ fontSize: "12px", opacity: 0.65 }}>
        {safeDate(item.created_at)}
      </div>
    </div>
  );
}
