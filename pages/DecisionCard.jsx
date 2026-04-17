import { styles } from "../../utils/dashboardStyles";
import { resolveCategory } from "../../utils/dashboardHelpers";
import CategoryBadge from "./CategoryBadge";

export default function DecisionCard({
  item,
  title,
  meta,
  formatDateFn,
  actions,
}) {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedTop}>
        <div>
          <div style={styles.feedName}>{title}</div>
          {meta && <div style={styles.feedMeta}>{meta}</div>}
        </div>
        <div style={styles.feedDate}>{formatDateFn(item.created_at)}</div>
      </div>

      <div style={styles.feedInlineRow}>
        <CategoryBadge category={resolveCategory(item)} />
        {item.policy_referenced && (
          <span style={styles.policyTag}>Policy: {item.policy_referenced}</span>
        )}
        {item.is_read === false && (
          <span style={styles.unreadBadge}>Unread</span>
        )}
      </div>

      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Situation</div>
        <div style={styles.feedBody}>{item.situation || "—"}</div>
      </div>

      <div style={styles.feedSection}>
        <div style={styles.feedLabel}>Action Taken</div>
        <div style={styles.feedBody}>{item.action_taken || "—"}</div>
      </div>

      {actions && <div style={styles.actionRow}>{actions}</div>}
    </div>
  );
}
