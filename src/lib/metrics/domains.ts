import type { Domain } from "@/lib/analysis/domains";

export interface DomainDefinition {
  id: Domain;
  name: string;
  icon: string;           // Lucide icon name
  color: string;          // Tailwind color class: 'blue-400'
  source: "automated" | "manual";
  description: string;
  defaultMetrics: string[]; // Metric IDs enabled by default for manual domains
}

export const DOMAIN_REGISTRY: DomainDefinition[] = [
  {
    id: "sleep",
    name: "Sleep",
    icon: "moon",
    color: "blue-400",
    source: "automated",
    description: "Track and analyze your sleep patterns and recovery",
    defaultMetrics: [],
  },
  {
    id: "fitness",
    name: "Fitness",
    icon: "dumbbell",
    color: "green-400",
    source: "automated",
    description: "Monitor workouts, activity levels, and cardiovascular fitness",
    defaultMetrics: [],
  },
  {
    id: "chess",
    name: "Chess",
    icon: "crown",
    color: "amber-400",
    source: "automated",
    description: "Analyze your chess performance, rating trends, and playing patterns",
    defaultMetrics: [],
  },
  {
    id: "wellbeing",
    name: "Wellbeing",
    icon: "heart",
    color: "rose-400",
    source: "manual",
    description: "Track mood, energy, stress, and focus through daily self-assessment",
    defaultMetrics: ["wellbeing_mood", "wellbeing_energy", "wellbeing_stress"],
  },
  {
    id: "recovery",
    name: "Recovery",
    icon: "activity",
    color: "emerald-400",
    source: "automated",
    description: "Monitor HRV, resting heart rate, and readiness to train",
    defaultMetrics: [],
  },
  {
    id: "caffeine",
    name: "Caffeine",
    icon: "coffee",
    color: "orange-400",
    source: "manual",
    description: "Track caffeine intake to understand its effects on sleep and performance",
    defaultMetrics: ["caffeine_total_daily", "caffeine_last_dose"],
  },
  {
    id: "hydration",
    name: "Hydration",
    icon: "droplets",
    color: "cyan-400",
    source: "manual",
    description: "Monitor daily water intake and its impact on energy and performance",
    defaultMetrics: ["hydration_water_intake"],
  },
  {
    id: "supplements",
    name: "Supplements",
    icon: "pill",
    color: "purple-400",
    source: "manual",
    description: "Track supplement usage and measure their impact on your metrics",
    defaultMetrics: ["supplements_taken"],
  },
  {
    id: "screen_time",
    name: "Screen Time",
    icon: "monitor",
    color: "indigo-400",
    source: "manual",
    description: "Track screen usage, especially before bed, and its effects on sleep and mood",
    defaultMetrics: ["screen_time_total", "screen_time_before_bed"],
  },
  {
    id: "substances",
    name: "Substances",
    icon: "wine",
    color: "red-400",
    source: "manual",
    description:
      "Understand how alcohol and other substances affect your recovery and performance",
    defaultMetrics: ["substances_alcohol"],
  },
];

export function getDomainById(id: Domain): DomainDefinition | undefined {
  return DOMAIN_REGISTRY.find((d) => d.id === id);
}

export function getManualDomains(): DomainDefinition[] {
  return DOMAIN_REGISTRY.filter((d) => d.source === "manual");
}

export function getAutomatedDomains(): DomainDefinition[] {
  return DOMAIN_REGISTRY.filter((d) => d.source === "automated");
}
