"use client";

import { ConfigurableStatCard } from "./ConfigurableStatCard";

interface StatCardConfig {
  metricId: string;
  domain: string;
}

interface DashboardConfigRow {
  position: number;
  config: StatCardConfig;
}

interface StatCardsSectionProps {
  initialConfigs: DashboardConfigRow[];
  pageDomain?: string | null;
}

export function StatCardsSection({ initialConfigs, pageDomain = null }: StatCardsSectionProps) {
  const configByPosition = new Map(initialConfigs.map((c) => [c.position, c.config]));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((pos) => (
        <ConfigurableStatCard
          key={pos}
          position={pos}
          domain={pageDomain}
          initialConfig={configByPosition.get(pos) ?? null}
        />
      ))}
    </div>
  );
}
