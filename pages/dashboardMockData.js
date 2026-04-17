// src/utils/dashboardMockData.js

function seedFromFacility(facilityNumber = "") {
  const cleaned = String(facilityNumber).replace(/\D/g, "");
  const base = cleaned ? Number(cleaned) : 7;
  return Number.isNaN(base) ? 7 : base;
}

/** GM facility-level snapshot — PR, PAS, TPR */
export function getMockGmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr: 72 + (s % 10),
    pas: 80 + (s % 8),
    tpr: 85 + (s % 9),
    ppd: null,
  };
}

/** AM area-level aggregate — PR, PAS, TPR, PP/D */
export function getMockAmMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr: 74 + (s % 8),
    pas: 82 + (s % 7),
    tpr: 87 + (s % 7),
    ppd: 33 + (s % 12),
  };
}

/** AM territory table — 4 mock facilities */
export function getMockTerritoryFacilities(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return [
    {
      number: `#${1040 + (s % 7)}`,
      pr: 76 + (s % 8),
      pas: 83 + (s % 6),
      tpr: 88 + (s % 6),
      ppd: 29 + (s % 10),
    },
    {
      number: `#${1048 + ((s + 3) % 7)}`,
      pr: 70 + ((s * 2) % 10),
      pas: 80 + (s % 7),
      tpr: 85 + ((s * 2) % 6),
      ppd: 40 + (s % 14),
    },
    {
      number: `#${1060 + (s % 9)}`,
      pr: 78 + (s % 7),
      pas: 85 + (s % 5),
      tpr: 90 + (s % 5),
      ppd: 27 + ((s * 3) % 8),
    },
    {
      number: `#${1070 + ((s + 5) % 9)}`,
      pr: 66 + ((s * 3) % 12),
      pas: 77 + (s % 8),
      tpr: 83 + (s % 7),
      ppd: 52 + (s % 10),
    },
  ];
}

/** Facility-level metrics used in the Facilities tab (Area Manager) */
export function getMockFacilityMetrics(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  return {
    pr: 72 + (s % 9),
    pas: 80 + (s % 8),
    tpr: 84 + (s % 10),
    ppd: 34 + (s % 9),
  };
}

/** Category breakdown for a single facility */
export function getMockBreakdown(facilityNumber) {
  const s = seedFromFacility(facilityNumber);
  const hr = 32 + (s % 18);
  const ops = 28 + ((s * 2) % 20);
  const food = Math.max(15, 100 - hr - ops);
  const total = hr + ops + food;

  return [
    { category: "HR", category_percent: +((hr / total) * 100).toFixed(2) },
    { category: "Operations", category_percent: +((ops / total) * 100).toFixed(2) },
    { category: "Food Safety", category_percent: +((food / total) * 100).toFixed(2) },
  ];
}

/** Load GM dashboard metrics. Replace body with real Supabase query later. */
export async function loadGmDashboardMetrics(profile) {
  return getMockGmMetrics(profile?.facility_number);
}

/** Load AM dashboard metrics. Replace body with real Supabase query later. */
export async function loadAmDashboardMetrics(profile) {
  return getMockAmMetrics(profile?.facility_number);
}

/** Load AM territory facilities. Replace body with real Supabase query later. */
export async function loadAmTerritoryData(profile) {
  return getMockTerritoryFacilities(profile?.facility_number);
}
