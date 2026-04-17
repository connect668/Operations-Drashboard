function safeDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

export default function CoachingCard({ request }) {
  const item = request || {};

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
      <div style={{ marginBottom: "8px", fontWeight: 700 }}>
        Coaching Request
      </div>

      <div style={{ marginBottom: "8px" }}>
        {item.request_text || "No request text provided."}
      </div>

      <div style={{ fontSize: "12px", opacity: 0.65 }}>
        {safeDate(item.created_at)}
      </div>
    </div>
  );
}
