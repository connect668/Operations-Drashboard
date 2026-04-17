import { styles } from "../utils/dashboardStyles";
import { getCategoryStyle } from "../utils/dashboardHelpers";

export default function CategoryBadge({ category }) {
  if (!category) return null;

  const tone = getCategoryStyle(category);

  return (
    <span
      style={{
        ...styles.categoryBadge,
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {category}
    </span>
  );
}
