import { createClient } from "@/lib/supabase/server";
import { getDomainById, DOMAIN_REGISTRY } from "@/lib/metrics/domains";
import { getMetricsByDomain } from "@/lib/metrics/registry";
import { StatCardsSection } from "@/components/dashboard/StatCardsSection";
import { ConfigurableGraph } from "@/components/dashboard/ConfigurableGraph";
import { MetricTable } from "@/components/domain/MetricTable";
import {
  Moon, Dumbbell, Crown, Heart, Activity,
  Coffee, Droplets, Pill, Monitor, Wine,
} from "lucide-react";
import type { Domain } from "@/lib/analysis/domains";
import type { GraphConfig } from "@/components/dashboard/GraphBuilderModal";

const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon, dumbbell: Dumbbell, crown: Crown, heart: Heart,
  activity: Activity, coffee: Coffee, droplets: Droplets,
  pill: Pill, monitor: Monitor, wine: Wine,
};

const DOMAIN_TEXT_COLORS: Record<string, string> = {
  "blue-400": "text-blue-400", "green-400": "text-green-400",
  "amber-400": "text-amber-400", "rose-400": "text-rose-400",
  "emerald-400": "text-emerald-400", "orange-400": "text-orange-400",
  "cyan-400": "text-cyan-400", "purple-400": "text-purple-400",
  "indigo-400": "text-indigo-400", "red-400": "text-red-400",
};

const GRAPH_DEFAULTS: Partial<Record<Domain, [GraphConfig, GraphConfig]>> = {
  sleep: [
    { metrics: [{ metricId: "sleep_total_duration", domain: "sleep" }], chartType: "line", days: 30 },
    { metrics: [{ metricId: "sleep_deep_pct", domain: "sleep" }], chartType: "area", days: 30 },
  ],
  fitness: [
    { metrics: [{ metricId: "fitness_steps", domain: "fitness" }], chartType: "bar", days: 30 },
    { metrics: [{ metricId: "fitness_resting_hr", domain: "fitness" }], chartType: "line", days: 30 },
  ],
  chess: [
    { metrics: [{ metricId: "chess_rating", domain: "chess" }], chartType: "line", days: 90 },
    { metrics: [{ metricId: "chess_accuracy", domain: "chess" }], chartType: "line", days: 30 },
  ],
};

interface DomainPageTemplateProps {
  domain: Domain;
  userId: string;
  children?: React.ReactNode;
}

export async function DomainPageTemplate({ domain, userId, children }: DomainPageTemplateProps) {
  const supabase = await createClient();
  const domainDef = getDomainById(domain);
  if (!domainDef) return null;

  const [{ data: statConfigs }, { data: graphConfigs }] = await Promise.all([
    supabase.from("user_dashboard_config").select("position,config").eq("user_id", userId).eq("config_type", "domain_stat_card").eq("domain", domain).order("position"),
    supabase.from("user_dashboard_config").select("position,config").eq("user_id", userId).eq("config_type", "domain_graph").eq("domain", domain).order("position"),
  ]);

  // Default stat card configs: first 4 chartable metrics for this domain
  const chartableMetrics = getMetricsByDomain(domain).filter(
    (m) => m.unit !== "text" && m.unit !== "category" && m.unit !== "name" && m.unit !== "ratio"
  );
  const statByPos = new Map((statConfigs ?? []).map((c: { position: number; config: { metricId: string; domain: string } }) => [c.position, c.config]));
  const statConfigArray = [0, 1, 2, 3].map((pos) => {
    const saved = statByPos.get(pos);
    if (saved) return { position: pos, config: saved };
    const metric = chartableMetrics[pos];
    if (!metric) return { position: pos, config: null };
    return { position: pos, config: { metricId: metric.id, domain } };
  }).filter((c): c is { position: number; config: { metricId: string; domain: string } } => c.config !== null);

  // Default graph configs
  const graphByPos = new Map((graphConfigs ?? []).map((c: { position: number; config: GraphConfig }) => [c.position, c.config]));
  const domainGraphDefaults = GRAPH_DEFAULTS[domain];
  const graphConfigArray = [0, 1].map((pos) => graphByPos.get(pos) ?? domainGraphDefaults?.[pos] ?? null);

  const Icon = DOMAIN_ICONS[domainDef.icon] ?? Activity;
  const iconColor = DOMAIN_TEXT_COLORS[domainDef.color] ?? "text-zinc-400";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">{domainDef.name}</h1>
        </div>
        <p className="text-sm text-zinc-400">{domainDef.description}</p>
      </div>

      {/* Section 1: Stat cards (domain-scoped) */}
      <section>
        <StatCardsSection
          initialConfigs={statConfigArray}
          configType="domain_stat_card"
          lockedDomain={domain}
          pageDomain={domain}
        />
      </section>

      {/* Section 2: Configurable graphs */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&_svg]:outline-none [&_*:focus]:outline-none">
          {[0, 1].map((pos) => (
            <ConfigurableGraph
              key={pos}
              position={pos}
              domain={domain}
              initialConfig={graphConfigArray[pos] as GraphConfig | null}
              configType="domain_graph"
              defaultDomain={domain}
            />
          ))}
        </div>
      </section>

      {/* Section 3: Recent activity (injected by each domain page) */}
      {children}

      {/* Section 4: All metrics table (power-user data, last) */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
          All metrics
        </h2>
        <MetricTable domain={domain} />
      </section>
    </div>
  );
}
