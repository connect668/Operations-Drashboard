// src/utils/dashboardHelpers.js

import {
  CATEGORY_STYLES,
  PALETTE,
  FALLBACK_CATEGORY_KEYWORDS,
} from "./dashboardConstants";

export function getNextRole(role) {
  if (role === "Manager") return "General Manager";
  if (role === "General Manager") return "Area Coach";
  return null;
}

export function formatDate(value) {
  if (!value) return "Unknown date";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function applyCompanyScope(query, scope) {
  if (scope?.company_id) return query.eq("company_id", scope.company_id);
  if (scope?.company) return query.eq("company", scope.company);
  return query;
}

export function getCategoryStyle(category) {
  return (
    CATEGORY_STYLES[category] || {
      color: PALETTE.textSoft,
      bg: "rgba(148, 163, 184, 0.08)",
      border: "rgba(148, 163, 184, 0.18)",
    }
  );
}

// PP/D: < 38 green · 38–55 amber · > 55 red
// All other metrics: ≥ 85 green · ≥ 70 amber · < 70 red
export function scoreMetricColor(metricKey, value) {
  if (metricKey === "ppd") {
    if (value < 38) return PALETTE.green;
    if (value > 55) return PALETTE.red;
    return PALETTE.amber;
  }
  if (value >= 85) return PALETTE.green;
  if (value >= 70) return PALETTE.amber;
  return PALETTE.red;
}

export function resolveCategory(item) {
  return item?.category || null;
}

export function buildKeywordMapFromRows(rows) {
  const map = { HR: [], Operations: [], "Food Safety": [] };
  rows.forEach((row) => {
    if (map[row.category]) {
      map[row.category].push({
        keyword: row.keyword,
        weight: row.weight || 1,
      });
    }
  });
  return map;
}

export function detectCategory(
  situation = "",
  action = "",
  keywordMap = FALLBACK_CATEGORY_KEYWORDS
) {
  const text = `${situation} ${action}`.toLowerCase().trim();
  if (!text) return { category: "", confidence: "review", score: 0 };

  const scores = Object.entries(keywordMap).map(([category, keywords]) => ({
    category,
    score: keywords.reduce(
      (t, e) =>
        text.includes(String(e.keyword).toLowerCase())
          ? t + Number(e.weight || 1)
          : t,
      0
    ),
  }));

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];

  if (!top || top.score <= 0) {
    return { category: "", confidence: "review", score: 0 };
  }
  if (second && top.score === second.score) {
    return { category: "", confidence: "review", score: top.score };
  }
  if (top.score >= 8) {
    return { category: top.category, confidence: "high", score: top.score };
  }
  if (top.score >= 4) {
    return { category: top.category, confidence: "medium", score: top.score };
  }
  return { category: top.category, confidence: "low", score: top.score };
}

export function animateMetrics(targetMetrics, setAnimated, duration = 1300) {
  const start = performance.now();
  const keys = Object.keys(targetMetrics).filter(
    (k) => targetMetrics[k] != null
  );

  let rafId;

  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const next = {};

    keys.forEach((k) => {
      next[k] = Math.round(targetMetrics[k] * eased);
    });

    setAnimated((prev) => ({ ...prev, ...next }));

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    }
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

export function normalizeBreakdownRows(rows, facilityNumber, getMockBreakdown) {
  if (!rows?.length) return getMockBreakdown(facilityNumber);

  const map = { HR: 0, Operations: 0, "Food Safety": 0 };

  rows.forEach((r) => {
    if (map[r.category] !== undefined) {
      map[r.category] = Number(r.category_percent || 0);
    }
  });

  return ["HR", "Operations", "Food Safety"].map((c) => ({
    category: c,
    category_percent: map[c],
  }));
}
