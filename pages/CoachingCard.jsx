import { styles } from "../../utils/dashboardStyles";

export default function CoachingCard({ item, formatDateFn }) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{formatDateFn(item.created_at)}</div>
          <div style={styles.feedMeta}>{item.status || "open"}</div>
        </div>
      </div>

      <div style={styles.feedBody}>{item.request_text || "—"}</div>

      {item.leadership_notes && (
        <div style={styles.guidanceBlock}>
          <div style={styles.guidanceLabel}>Guidance</div>
          <div style={styles.feedBody}>{item.leadership_notes}</div>
        </div>
      )}
    </div>
  );
}
