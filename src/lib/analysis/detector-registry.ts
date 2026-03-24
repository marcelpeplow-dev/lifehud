import type { Domain } from "./domains";
import type { UserDataBundle } from "./data-bundle";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetectedPattern {
  detectorId: string;
  type: string;
  description: string;
  domains: Domain[];
  data: Record<string, unknown>;
  significance: number; // 0.0–1.0 continuous
  effectSize: number;   // actual percentage difference, e.g. 0.27 = 27%
}

export interface DetectorDefinition {
  id: string;
  name: string;
  requiredDomains: Domain[];
  category: "single" | "cross";
  detect: (data: UserDataBundle) => DetectedPattern | null;
}

// ── Registry ─────────────────────────────────────────────────────────────────

const DETECTOR_REGISTRY: DetectorDefinition[] = [];

export function registerDetector(def: DetectorDefinition): void {
  DETECTOR_REGISTRY.push(def);
}

export function getApplicableDetectors(
  activeDomains: Set<Domain>,
): DetectorDefinition[] {
  return DETECTOR_REGISTRY.filter((d) =>
    d.requiredDomains.every((domain) => activeDomains.has(domain)),
  );
}

export function getAllDetectors(): DetectorDefinition[] {
  return [...DETECTOR_REGISTRY];
}
