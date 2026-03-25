"use client";

import { useState, useEffect } from "react";
import type { Domain } from "@/lib/analysis/domains";

export interface DomainMetricData {
  metricId: string;
  name: string;
  shortName: string;
  description: string;
  unit: string;
  unitLabel: string;
  healthyRange: { min: number; max: number; label: string } | null;
  today: number | null;
  avg7d: number | null;
  avg30d: number | null;
  avg90d: number | null;
  trend: "up" | "down" | "flat" | null;
  formatted: {
    today: string | null;
    avg7d: string | null;
    avg30d: string | null;
    avg90d: string | null;
  };
}

export function useDomainMetrics(domain: Domain) {
  const [metrics, setMetrics] = useState<DomainMetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/domain-metrics?domain=${domain}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load metrics");
        return r.json() as Promise<{ metrics: DomainMetricData[] }>;
      })
      .then((d) => { setMetrics(d.metrics); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [domain]);

  return { metrics, loading, error };
}
