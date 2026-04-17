export default function TerritoryTable({ rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #374151",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Territory Overview</h3>

      {safeRows.length === 0 ? (
        <p>No territory data available.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px" }}>Facility</th>
              <th style={{ textAlign: "left", padding: "8px" }}>GM</th>
              <th style={{ textAlign: "left", padding: "8px" }}>PR</th>
              <th style={{ textAlign: "left", padding: "8px" }}>PAS</th>
              <th style={{ textAlign: "left", padding: "8px" }}>TPR</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, index) => (
              <tr key={row?.id || index}>
                <td style={{ padding: "8px" }}>{row?.facility || "-"}</td>
                <td style={{ padding: "8px" }}>{row?.gm || "-"}</td>
                <td style={{ padding: "8px" }}>{row?.pr ?? "-"}</td>
                <td style={{ padding: "8px" }}>{row?.pas ?? "-"}</td>
                <td style={{ padding: "8px" }}>{row?.tpr ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
