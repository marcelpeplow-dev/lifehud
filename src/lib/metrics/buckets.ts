export interface BucketOption {
  label: string;       // "None", "Low", "Moderate", "High"
  rangeText: string;   // "0 mg", "1-100 mg" — full grammar, no abbreviations
  storedValue: number; // midpoint saved to manual_entries
}

export interface BucketDomain {
  metricId: string;    // metric_id saved to manual_entries
  domain: string;      // domain id for icon/color lookup
  displayName: string; // "Caffeine", "Alcohol", etc.
  exactUnit: string;   // "mg", "drinks", "litres", "hours"
  buckets: BucketOption[];
}

export const BUCKET_DEFINITIONS: BucketDomain[] = [
  {
    metricId: "caffeine_total_daily",
    domain: "caffeine",
    displayName: "Caffeine",
    exactUnit: "mg",
    buckets: [
      { label: "None",     rangeText: "0 mg",       storedValue: 0 },
      { label: "Low",      rangeText: "1-100 mg",   storedValue: 75 },
      { label: "Moderate", rangeText: "100-200 mg", storedValue: 150 },
      { label: "High",     rangeText: "200+ mg",    storedValue: 300 },
    ],
  },
  {
    metricId: "substances_alcohol",
    domain: "substances",
    displayName: "Alcohol",
    exactUnit: "drinks",
    buckets: [
      { label: "None",     rangeText: "0 drinks",   storedValue: 0 },
      { label: "Low",      rangeText: "1-2 drinks", storedValue: 1.5 },
      { label: "Moderate", rangeText: "3-4 drinks", storedValue: 3.5 },
      { label: "High",     rangeText: "5+ drinks",  storedValue: 6 },
    ],
  },
  {
    metricId: "hydration_water_intake",
    domain: "hydration",
    displayName: "Hydration",
    exactUnit: "litres",
    buckets: [
      { label: "Low",      rangeText: "Under 1.5 litres", storedValue: 1 },
      { label: "Moderate", rangeText: "1.5-3 litres",     storedValue: 2.25 },
      { label: "High",     rangeText: "3+ litres",        storedValue: 3.5 },
    ],
  },
  {
    metricId: "screen_time_before_bed",
    domain: "screen_time",
    displayName: "Screen time before bed",
    exactUnit: "hours",
    buckets: [
      { label: "None",     rangeText: "0 hours",           storedValue: 0 },
      { label: "Low",      rangeText: "Under 30 minutes",  storedValue: 0.25 },
      { label: "Moderate", rangeText: "30-60 minutes",     storedValue: 0.75 },
      { label: "High",     rangeText: "1+ hours",          storedValue: 1.5 },
    ],
  },
];
