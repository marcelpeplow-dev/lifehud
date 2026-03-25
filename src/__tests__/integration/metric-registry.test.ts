import { describe, it, expect } from "vitest";
import { METRIC_REGISTRY, getMetricsByDomain, getMetricById } from "@/lib/metrics/registry";
import { DOMAIN_REGISTRY } from "@/lib/metrics/domains";

describe("Metric Registry Integrity", () => {
  it("has at least 50 metrics registered", () => {
    expect(METRIC_REGISTRY.length).toBeGreaterThanOrEqual(50);
  });

  it("every metric has required fields", () => {
    for (const m of METRIC_REGISTRY) {
      expect(m.id, `${m.id} missing id`).toBeTruthy();
      expect(m.domain, `${m.id} missing domain`).toBeTruthy();
      expect(m.name, `${m.id} missing name`).toBeTruthy();
      expect(m.shortName, `${m.id} missing shortName`).toBeTruthy();
      expect(m.unit, `${m.id} missing unit`).toBeTruthy();
      expect(m.unitLabel, `${m.id} missing unitLabel`).toBeDefined();
      expect(typeof m.format, `${m.id} format must be function`).toBe("function");
      expect(Array.isArray(m.detectorIds), `${m.id} detectorIds must be array`).toBe(true);
      expect(
        ["wearable", "chess_api", "lichess_api", "manual"].includes(m.source),
        `${m.id} invalid source: ${m.source}`,
      ).toBe(true);
    }
  });

  it("every metric's domain exists in DOMAIN_REGISTRY", () => {
    const domainIds = new Set(DOMAIN_REGISTRY.map((d) => d.id));
    for (const m of METRIC_REGISTRY) {
      expect(
        domainIds.has(m.domain),
        `metric ${m.id} references unknown domain "${m.domain}"`,
      ).toBe(true);
    }
  });

  it("format functions don't throw for typical values", () => {
    const testValues = [0, 1, 7.5, 10, 100, 420, 1000];
    for (const m of METRIC_REGISTRY) {
      for (const v of testValues) {
        expect(
          () => m.format(v),
          `${m.id}.format(${v}) threw`,
        ).not.toThrow();
        expect(
          typeof m.format(v),
          `${m.id}.format(${v}) should return string`,
        ).toBe("string");
      }
    }
  });

  it("manual metrics have inputType defined", () => {
    const manualMetrics = METRIC_REGISTRY.filter((m) => m.source === "manual");
    expect(manualMetrics.length).toBeGreaterThan(0);
    for (const m of manualMetrics) {
      expect(
        m.inputType,
        `manual metric ${m.id} must have inputType`,
      ).toBeDefined();
    }
  });

  it("no duplicate metric IDs", () => {
    const ids = METRIC_REGISTRY.map((m) => m.id);
    const unique = new Set(ids);
    expect(
      unique.size,
      `Duplicate IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`,
    ).toBe(ids.length);
  });

  it("getMetricsByDomain returns correct counts per domain", () => {
    // Domains that intentionally share metrics with other domains (e.g. recovery
    // uses fitness/sleep metrics) may have 0 direct metrics — skip those.
    const domainsWithMetrics = DOMAIN_REGISTRY.filter(
      (d) => getMetricsByDomain(d.id).length > 0,
    );
    expect(domainsWithMetrics.length).toBeGreaterThanOrEqual(9);

    for (const domain of domainsWithMetrics) {
      const metrics = getMetricsByDomain(domain.id);
      expect(metrics.length).toBeGreaterThan(0);
      // All returned metrics belong to that domain
      for (const m of metrics) {
        expect(m.domain).toBe(domain.id);
      }
    }
  });

  it("getMetricById returns the correct metric", () => {
    const first = METRIC_REGISTRY[0];
    const found = getMetricById(first.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(first.id);
  });

  it("getMetricById returns undefined for unknown id", () => {
    expect(getMetricById("__nonexistent_metric__")).toBeUndefined();
  });

  it("sleep domain has 14 metrics", () => {
    expect(getMetricsByDomain("sleep").length).toBe(14);
  });

  it("fitness domain has at least 10 metrics", () => {
    expect(getMetricsByDomain("fitness").length).toBeGreaterThanOrEqual(10);
  });

  it("manual metrics all have valid inputType values", () => {
    const validInputTypes = ["slider", "number", "time", "toggle", "stepper", "text"];
    const manualMetrics = METRIC_REGISTRY.filter((m) => m.source === "manual");
    for (const m of manualMetrics) {
      expect(
        validInputTypes.includes(m.inputType!),
        `${m.id} has invalid inputType "${m.inputType}"`,
      ).toBe(true);
    }
  });
});
