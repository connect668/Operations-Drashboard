export default function MetricCard({
  metricKey,
  label,
  value,
  color,
  status,
  formatPercent,
}) {
  const displayValue =
    typeof formatPercent === "function"
      ? formatPercent(value ?? 0)
      : `${value ?? 0}%`;

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #374151",
        borderRadius: "12px",
        padding: "16px",
        minHeight: "110px",
      }}
    >
      <div style={{ fontSize: "12px", opacity: 0.7, marginBottom: "8px" }}>
        {label || metricKey || "Metric"}
      </div>

      <div style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>
        {displayValue}
      </div>

      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: color || "#9CA3AF",
        }}
      >
        {status || "neutral"}
      </div>
    </div>
  );
}
