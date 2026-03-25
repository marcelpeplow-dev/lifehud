import { describe, it, expect } from "vitest";
import { scoreAndBudget } from "@/lib/analysis/pattern-scorer";
import type { DetectedPattern } from "@/lib/analysis/detector-registry";
import type { Domain } from "@/lib/analysis/domains";
import type { Insight } from "@/types/index";

function makePattern(overrides: Partial<DetectedPattern> = {}): DetectedPattern {
  return {
    detectorId: "TEST_DETECTOR",
    type: "test",
    description: "Test pattern",
    domains: ["sleep"] as Domain[],
    data: {},
    significance: 0.8,
    effectSize: 0.15,
    ...overrides,
  };
}

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    user_id: "u1",
    date: new Date().toISOString().slice(0, 10),
    category: "sleep",
    title: "Test insight",
    body: "Test body",
    data_points: null,
    priority: 0,
    rarity: "common",
    is_read: false,
    is_dismissed: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("Pattern Scorer — budget sizing", () => {
  it("1 domain → budget of 6", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({ detectorId: `DET_${i}`, domains: ["sleep"] }),
    );
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep"]));
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("2 domains → budget of 8", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({ detectorId: `DET_${i}`, domains: ["sleep"] }),
    );
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep", "fitness"]));
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("3 domains → budget of 10", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({ detectorId: `DET_${i}`, domains: ["sleep"] }),
    );
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep", "fitness", "chess"]));
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("4+ domains → budget of 12", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({ detectorId: `DET_${i}`, domains: ["sleep"] }),
    );
    const result = scoreAndBudget(
      patterns, [], new Set<Domain>(["sleep", "fitness", "chess", "wellbeing"])
    );
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it("maxPatterns override respected", () => {
    const patterns = Array.from({ length: 20 }, (_, i) =>
      makePattern({ detectorId: `DET_${i}`, domains: ["sleep"] }),
    );
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep"]), 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe("Pattern Scorer — scoring formula", () => {
  it("finalScore = significance × noveltyScore × domainBonus", () => {
    const pattern = makePattern({ significance: 0.8, domains: ["sleep"] });
    const [scored] = scoreAndBudget([pattern], [], new Set<Domain>(["sleep"]));
    // No prior insights → noveltyScore = 1.0; 1 domain → domainBonus = 1.0
    expect(scored.noveltyScore).toBe(1.0);
    expect(scored.domainBonus).toBe(1.0);
    expect(scored.finalScore).toBeCloseTo(0.8 * 1.0 * 1.0);
  });

  it("cross-domain 2 domains → domainBonus = 1.5", () => {
    const pattern = makePattern({
      significance: 0.8,
      domains: ["sleep", "fitness"] as Domain[],
    });
    const [scored] = scoreAndBudget([pattern], [], new Set<Domain>(["sleep", "fitness"]));
    expect(scored.domainBonus).toBe(1.5);
    expect(scored.finalScore).toBeCloseTo(0.8 * 1.0 * 1.5);
  });

  it("cross-domain 3+ domains → domainBonus = 2.0", () => {
    const pattern = makePattern({
      significance: 0.6,
      domains: ["sleep", "fitness", "chess"] as Domain[],
    });
    const [scored] = scoreAndBudget([pattern], [], new Set<Domain>(["sleep", "fitness", "chess"]));
    expect(scored.domainBonus).toBe(2.0);
    expect(scored.finalScore).toBeCloseTo(0.6 * 1.0 * 2.0);
  });
});

describe("Pattern Scorer — novelty scoring", () => {
  it("no prior insights → noveltyScore = 1.0", () => {
    const pattern = makePattern({ detectorId: "DET_NEW" });
    const [scored] = scoreAndBudget([pattern], [], new Set<Domain>(["sleep"]));
    expect(scored.noveltyScore).toBe(1.0);
  });

  it("insight within 3 days → noveltyScore = 0.1", () => {
    const recentInsight = makeInsight({
      created_at: new Date().toISOString(), // today
      data_points: { detectorId: "DET_RECENT" },
    });
    const pattern = makePattern({ detectorId: "DET_RECENT" });
    const [scored] = scoreAndBudget([pattern], [recentInsight], new Set<Domain>(["sleep"]));
    expect(scored.noveltyScore).toBe(0.1);
  });

  it("insight 7+ days ago → noveltyScore = 0.7", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8);
    const oldInsight = makeInsight({
      created_at: oldDate.toISOString(),
      data_points: { detectorId: "DET_OLD" },
    });
    const pattern = makePattern({ detectorId: "DET_OLD" });
    const [scored] = scoreAndBudget([pattern], [oldInsight], new Set<Domain>(["sleep"]));
    expect(scored.noveltyScore).toBe(0.7);
  });

  it("insight 3-7 days ago → noveltyScore = 0.4", () => {
    const midDate = new Date();
    midDate.setDate(midDate.getDate() - 5);
    const midInsight = makeInsight({
      created_at: midDate.toISOString(),
      data_points: { detectorId: "DET_MID" },
    });
    const pattern = makePattern({ detectorId: "DET_MID" });
    const [scored] = scoreAndBudget([pattern], [midInsight], new Set<Domain>(["sleep"]));
    expect(scored.noveltyScore).toBe(0.4);
  });
});

describe("Pattern Scorer — deduplication", () => {
  it("keeps only the highest-scoring pattern per detectorId", () => {
    const patterns = [
      makePattern({ detectorId: "SAME_DET", significance: 0.9 }),
      makePattern({ detectorId: "SAME_DET", significance: 0.3 }),
      makePattern({ detectorId: "SAME_DET", significance: 0.6 }),
    ];
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep"]));
    const sameDetPatterns = result.filter((p) => p.detectorId === "SAME_DET");
    expect(sameDetPatterns.length).toBe(1);
    expect(sameDetPatterns[0].significance).toBe(0.9);
  });
});

describe("Pattern Scorer — domain reservation", () => {
  it("guarantees each active domain gets a representative pattern", () => {
    // Two domains, with patterns for each
    const patterns = [
      makePattern({ detectorId: "SLEEP_DET", domains: ["sleep"] as Domain[], significance: 0.3 }),
      makePattern({ detectorId: "FITNESS_DET", domains: ["fitness"] as Domain[], significance: 0.4 }),
    ];
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep", "fitness"]));
    const domains = new Set(result.flatMap((p) => p.domains));
    expect(domains.has("sleep")).toBe(true);
    expect(domains.has("fitness")).toBe(true);
  });

  it("returns empty array when no patterns provided", () => {
    const result = scoreAndBudget([], [], new Set<Domain>(["sleep"]));
    expect(result).toEqual([]);
  });

  it("results are sorted by finalScore descending", () => {
    const patterns = [
      makePattern({ detectorId: "D1", significance: 0.3 }),
      makePattern({ detectorId: "D2", significance: 0.9 }),
      makePattern({ detectorId: "D3", significance: 0.6 }),
    ];
    const result = scoreAndBudget(patterns, [], new Set<Domain>(["sleep"]));
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].finalScore).toBeGreaterThanOrEqual(result[i].finalScore);
    }
  });
});
