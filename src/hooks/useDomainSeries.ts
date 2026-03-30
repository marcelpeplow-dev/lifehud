"use client";

import { useState, useEffect } from "react";
import type { Domain } from "@/lib/analysis/domains";
import type { SeriesPoint } from "@/lib/metrics/fetch-series";

export function useDomainSeries(domain: Domain) {
  const [series, setSeries] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/domain-series?domain=${domain}&days=7`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load series");
        return r.json() as Promise<{ series: Record<string, SeriesPoint[]> }>;
      })
      .then((d) => { setSeries(d.series); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [domain]);

  return { series, loading };
}
