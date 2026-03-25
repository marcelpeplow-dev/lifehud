import { describe, it, expect, beforeAll } from "vitest";
import { getAllDetectors, getApplicableDetectors } from "@/lib/analysis/detector-registry";
import type { Domain } from "@/lib/analysis/domains";

// Import all detectors to trigger registration
import "@/lib/analysis/detectors/index";

const VALID_DOMAINS: Domain[] = [
  "sleep", "fitness", "chess", "wellbeing", "recovery",
  "caffeine", "hydration", "supplements", "screen_time", "substances",
];

describe("Detector Registry Integrity", () => {
  let detectors: ReturnType<typeof getAllDetectors>;

  beforeAll(() => {
    detectors = getAllDetectors();
  });

  it("has detectors registered", () => {
    expect(detectors.length).toBeGreaterThan(0);
  });

  it("has at least 20 detectors", () => {
    expect(detectors.length).toBeGreaterThanOrEqual(20);
  });

  it("all detectors have required fields", () => {
    for (const d of detectors) {
      expect(d.id, "detector missing id").toBeTruthy();
      expect(d.name, `${d.id} missing name`).toBeTruthy();
      expect(Array.isArray(d.requiredDomains), `${d.id} requiredDomains must be array`).toBe(true);
      expect(
        ["single", "cross"].includes(d.category),
        `${d.id} invalid category: ${d.category}`,
      ).toBe(true);
      expect(typeof d.detect, `${d.id} detect must be function`).toBe("function");
    }
  });

  it("no duplicate detector IDs", () => {
    const ids = detectors.map((d) => d.id);
    const unique = new Set(ids);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(unique.size, `Duplicate detector IDs: ${dupes.join(", ")}`).toBe(ids.length);
  });

  it("every requiredDomain is a valid Domain", () => {
    const validSet = new Set<string>(VALID_DOMAINS);
    for (const d of detectors) {
      for (const domain of d.requiredDomains) {
        expect(
          validSet.has(domain),
          `detector "${d.id}" requires unknown domain "${domain}"`,
        ).toBe(true);
      }
    }
  });

  it('no detector uses "mood" as a domain (should be "wellbeing")', () => {
    for (const d of detectors) {
      expect(
        d.requiredDomains,
        `detector "${d.id}" still uses "mood" domain`,
      ).not.toContain("mood");
    }
  });

  it("single-domain detectors have exactly 1 requiredDomain", () => {
    const single = detectors.filter((d) => d.category === "single");
    for (const d of single) {
      expect(
        d.requiredDomains.length,
        `single-domain detector "${d.id}" should have 1 requiredDomain, has ${d.requiredDomains.length}`,
      ).toBe(1);
    }
  });

  it("cross-domain detectors have at least 1 requiredDomain", () => {
    // Some "cross" detectors analyze temporal cross-day patterns within one
    // domain (e.g. alcohol tonight → next-day metrics), so 1 domain is valid.
    const cross = detectors.filter((d) => d.category === "cross");
    for (const d of cross) {
      expect(
        d.requiredDomains.length,
        `cross-domain detector "${d.id}" should have ≥1 requiredDomain`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("detect functions return null or a valid DetectedPattern on empty data", () => {
    const emptyBundle = {
      userId: "test-user",
      activeDomains: new Set<Domain>(VALID_DOMAINS),
      sleepRecords: [],
      workouts: [],
      dailyMetrics: [],
      checkins: [],
      chessGames: [],
      goals: [],
      sleepByDate: new Map(),
      workoutsByDate: new Map(),
      checkinByDate: new Map(),
      metricsByDate: new Map(),
      chessByDate: new Map(),
      manualEntries: [],
      manualByDateAndMetric: new Map(),
      recentInsights: [],
    };

    for (const d of detectors) {
      let result: ReturnType<typeof d.detect>;
      expect(
        () => { result = d.detect(emptyBundle); },
        `detector "${d.id}" threw on empty bundle`,
      ).not.toThrow();

      if (result !== null && result !== undefined) {
        expect(result.detectorId, `${d.id} result missing detectorId`).toBeTruthy();
        expect(typeof result.significance, `${d.id} result significance must be number`).toBe("number");
        expect(result.significance, `${d.id} significance must be 0-1`).toBeGreaterThanOrEqual(0);
        expect(result.significance, `${d.id} significance must be 0-1`).toBeLessThanOrEqual(1);
        expect(Array.isArray(result.domains), `${d.id} result domains must be array`).toBe(true);
      }
    }
  });

  it("getApplicableDetectors filters by required domains", () => {
    // Only sleep domain — should return only single-domain sleep detectors
    const sleepOnly = getApplicableDetectors(new Set<Domain>(["sleep"]));
    for (const d of sleepOnly) {
      expect(d.requiredDomains.every((dom) => dom === "sleep")).toBe(true);
    }

    // Sleep + fitness — should include cross-domain sleep-fitness detectors
    const sleepFitness = getApplicableDetectors(new Set<Domain>(["sleep", "fitness"]));
    expect(sleepFitness.length).toBeGreaterThan(sleepOnly.length);

    // All domains — should return all detectors
    const all = getApplicableDetectors(new Set<Domain>(VALID_DOMAINS));
    expect(all.length).toBe(detectors.length);
  });

  it("getApplicableDetectors returns empty for empty domain set", () => {
    const result = getApplicableDetectors(new Set<Domain>());
    // Only detectors with no required domains could match, which should be 0
    for (const d of result) {
      expect(d.requiredDomains.length).toBe(0);
    }
  });
});
