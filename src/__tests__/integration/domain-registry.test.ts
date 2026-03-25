import { describe, it, expect } from "vitest";
import {
  DOMAIN_REGISTRY,
  getDomainById,
  getManualDomains,
  getAutomatedDomains,
} from "@/lib/metrics/domains";
import { METRIC_REGISTRY } from "@/lib/metrics/registry";

describe("Domain Registry Integrity", () => {
  it("has 10 domains registered", () => {
    expect(DOMAIN_REGISTRY.length).toBe(10);
  });

  it("all domains have required fields", () => {
    for (const d of DOMAIN_REGISTRY) {
      expect(d.id, `domain missing id`).toBeTruthy();
      expect(d.name, `${d.id} missing name`).toBeTruthy();
      expect(d.icon, `${d.id} missing icon`).toBeTruthy();
      expect(d.color, `${d.id} missing color`).toBeTruthy();
      expect(d.description, `${d.id} missing description`).toBeTruthy();
      expect(
        ["automated", "manual"].includes(d.source),
        `${d.id} invalid source: ${d.source}`,
      ).toBe(true);
      expect(Array.isArray(d.defaultMetrics), `${d.id} defaultMetrics must be array`).toBe(true);
    }
  });

  it("no duplicate domain IDs", () => {
    const ids = DOMAIN_REGISTRY.map((d) => d.id);
    const unique = new Set(ids);
    expect(
      unique.size,
      `Duplicate domain IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`,
    ).toBe(ids.length);
  });

  it("manual domains have defaultMetrics that exist in METRIC_REGISTRY", () => {
    const metricIds = new Set(METRIC_REGISTRY.map((m) => m.id));
    const manualDomains = DOMAIN_REGISTRY.filter((d) => d.source === "manual");
    for (const d of manualDomains) {
      for (const metricId of d.defaultMetrics) {
        expect(
          metricIds.has(metricId),
          `domain "${d.id}" defaultMetric "${metricId}" not in METRIC_REGISTRY`,
        ).toBe(true);
      }
    }
  });

  it("getDomainById returns correct domain for each ID", () => {
    for (const d of DOMAIN_REGISTRY) {
      const found = getDomainById(d.id);
      expect(found, `getDomainById("${d.id}") returned undefined`).toBeDefined();
      expect(found?.id).toBe(d.id);
      expect(found?.name).toBe(d.name);
    }
  });

  it("getDomainById returns undefined for unknown ID", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getDomainById("__nonexistent__" as any)).toBeUndefined();
  });

  it("has 4 automated domains", () => {
    const automated = getAutomatedDomains();
    // sleep, fitness, chess, recovery
    expect(automated.length).toBe(4);
    expect(automated.every((d) => d.source === "automated")).toBe(true);
  });

  it("has 6 manual domains", () => {
    const manual = getManualDomains();
    // wellbeing, caffeine, hydration, supplements, screen_time, substances
    expect(manual.length).toBe(6);
    expect(manual.every((d) => d.source === "manual")).toBe(true);
  });

  it("includes expected domains", () => {
    const ids = new Set(DOMAIN_REGISTRY.map((d) => d.id));
    const expected = [
      "sleep", "fitness", "chess", "wellbeing", "recovery",
      "caffeine", "hydration", "supplements", "screen_time", "substances",
    ];
    for (const id of expected) {
      expect(ids.has(id as never), `missing expected domain "${id}"`).toBe(true);
    }
  });

  it("does NOT contain a 'mood' domain (renamed to wellbeing)", () => {
    const ids = DOMAIN_REGISTRY.map((d) => d.id);
    expect(ids).not.toContain("mood");
  });

  it("color values use the expected Tailwind pattern", () => {
    for (const d of DOMAIN_REGISTRY) {
      expect(
        d.color,
        `${d.id}.color "${d.color}" should match tailwind color pattern`,
      ).toMatch(/^[a-z]+-\d+$/);
    }
  });
});
