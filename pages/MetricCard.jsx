import { styles } from "../utils/dashboardStyles";
import { scoreMetricColor } from "../utils/dashboardHelpers";

export default function MetricCard({ metric, value }) {
  const color = scoreMetricColor(metric.key, value);
  const barWidth = Math.max(0, Math.min(100, value));

  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{metric.label}</div>

      <div style={{ ...styles.metricValue, color }}>
        {Math.round(value)}
        {metric.unit}
      </div>

      <div style={styles.metricBarTrack}>
        <div
          style={{
            ...styles.metricBarFill,
            width: `${barWidth}%`,
            background: color,
          }}
        />
      </div>

      <div style={styles.metricDesc}>{metric.desc}</div>

      {metric.key === "ppd" && (
        <div style={styles.metricTarget}>Target: under 38%</div>
      )}
    </div>
  );
}
