import { AM_METRIC_DEFS, PALETTE } from "../../utils/dashboardConstants";
import { scoreMetricColor } from "../../utils/dashboardHelpers";
import { styles } from "../../utils/dashboardStyles";

export default function TerritoryTable({ facilities }) {
  return (
    <div style={styles.territoryTableWrap}>
      <div style={styles.territoryHeaderRow}>
        <div
          style={{
            ...styles.territoryCell,
            flex: "0 0 88px",
            ...styles.territoryCellLabel,
          }}
        >
          Facility
        </div>

        {AM_METRIC_DEFS.map((m) => (
          <div
            key={m.key}
            style={{
              ...styles.territoryCell,
              ...styles.territoryCellLabel,
            }}
          >
            {m.label}
          </div>
        ))}

        <div
          style={{
            ...styles.territoryCell,
            flex: "0 0 96px",
            ...styles.territoryCellLabel,
          }}
        >
          Status
        </div>
      </div>

      {facilities.map((fac) => {
        const colors = {
          pr: scoreMetricColor("pr", fac.pr),
          pas: scoreMetricColor("pas", fac.pas),
          tpr: scoreMetricColor("tpr", fac.tpr),
          ppd: scoreMetricColor("ppd", fac.ppd),
        };

        const alertCount = Object.values(colors).filter(
          (c) => c === PALETTE.red
        ).length;

        const warnCount = Object.values(colors).filter(
          (c) => c === PALETTE.amber
        ).length;

        const statusLabel =
          alertCount > 0 ? "Alert" : warnCount > 1 ? "Attention" : "On Track";

        const statusColor =
          alertCount > 0
            ? PALETTE.red
            : warnCount > 1
            ? PALETTE.amber
            : PALETTE.green;

        const statusBg =
          alertCount > 0
            ? PALETTE.redSoft
            : warnCount > 1
            ? PALETTE.amberSoft
            : PALETTE.greenSoft;

        const statusBorder =
          alertCount > 0
            ? "rgba(138,72,72,0.26)"
            : warnCount > 1
            ? "rgba(154,120,64,0.26)"
            : "rgba(74,124,97,0.26)";

        return (
          <div key={fac.number} style={styles.territoryDataRow}>
            <div
              style={{
                ...styles.territoryCell,
                flex: "0 0 88px",
                fontWeight: 700,
                color: PALETTE.text,
                fontSize: "14px",
              }}
            >
              {fac.number}
            </div>

            {[
              { key: "pr", val: fac.pr },
              { key: "pas", val: fac.pas },
              { key: "tpr", val: fac.tpr },
              { key: "ppd", val: fac.ppd },
            ].map(({ key, val }) => (
              <div
                key={key}
                style={{
                  ...styles.territoryCell,
                  color: colors[key],
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                {val}%
              </div>
            ))}

            <div
              style={{
                ...styles.territoryCell,
                flex: "0 0 96px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 9px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: statusBg,
                  border: `1px solid ${statusBorder}`,
                  color: statusColor,
                  letterSpacing: "0.04em",
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: statusColor,
                    flexShrink: 0,
                  }}
                />
                {statusLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
