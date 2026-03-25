/**
 * API Routes structure tests.
 * These verify that each route module exports the expected HTTP handler functions.
 * They don't require a running server or database.
 */
import { describe, it, expect } from "vitest";

// Helper: assert a module has expected exports
function assertHandlers(mod: Record<string, unknown>, handlers: string[], routePath: string) {
  for (const handler of handlers) {
    expect(
      typeof mod[handler],
      `${routePath} should export ${handler}`,
    ).toBe("function");
  }
}

describe("API Routes — module structure", () => {
  it("/api/manual-config exports GET, PUT", async () => {
    const mod = await import("@/app/api/manual-config/route");
    assertHandlers(mod as Record<string, unknown>, ["GET", "PUT"], "/api/manual-config");
  });

  it("/api/manual-entries exports GET, POST", async () => {
    const mod = await import("@/app/api/manual-entries/route");
    assertHandlers(mod as Record<string, unknown>, ["GET", "POST"], "/api/manual-entries");
  });

  it("/api/dashboard-config exports GET, PUT, DELETE", async () => {
    const mod = await import("@/app/api/dashboard-config/route");
    assertHandlers(mod as Record<string, unknown>, ["GET", "PUT", "DELETE"], "/api/dashboard-config");
  });

  it("/api/insights/generate exports POST", async () => {
    const mod = await import("@/app/api/insights/generate/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/insights/generate");
  });

  it("/api/metric-value exports GET", async () => {
    const mod = await import("@/app/api/metric-value/route");
    assertHandlers(mod as Record<string, unknown>, ["GET"], "/api/metric-value");
  });

  it("/api/metric-series exports GET", async () => {
    const mod = await import("@/app/api/metric-series/route");
    assertHandlers(mod as Record<string, unknown>, ["GET"], "/api/metric-series");
  });

  it("/api/checkins exports GET, POST", async () => {
    const mod = await import("@/app/api/checkins/route");
    assertHandlers(mod as Record<string, unknown>, ["GET", "POST"], "/api/checkins");
  });

  it("/api/goals exports POST", async () => {
    const mod = await import("@/app/api/goals/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/goals");
  });

  it("/api/goals/[id] exports PATCH", async () => {
    const mod = await import("@/app/api/goals/[id]/route");
    assertHandlers(mod as Record<string, unknown>, ["PATCH"], "/api/goals/[id]");
  });

  it("/api/daily-action exports POST", async () => {
    const mod = await import("@/app/api/daily-action/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/daily-action");
  });

  it("/api/seed exports GET, POST", async () => {
    const mod = await import("@/app/api/seed/route");
    assertHandlers(mod as Record<string, unknown>, ["GET", "POST"], "/api/seed");
  });

  it("/api/import/confirm exports POST", async () => {
    const mod = await import("@/app/api/import/confirm/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/import/confirm");
  });

  it("/api/import/clear exports DELETE", async () => {
    const mod = await import("@/app/api/import/clear/route");
    assertHandlers(mod as Record<string, unknown>, ["DELETE"], "/api/import/clear");
  });

  it("/api/chess/connect exports POST, DELETE", async () => {
    const mod = await import("@/app/api/chess/connect/route");
    assertHandlers(mod as Record<string, unknown>, ["POST", "DELETE"], "/api/chess/connect");
  });

  it("/api/chess/sync exports POST", async () => {
    const mod = await import("@/app/api/chess/sync/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/chess/sync");
  });

  it("/api/lichess/connect exports POST, DELETE", async () => {
    const mod = await import("@/app/api/lichess/connect/route");
    assertHandlers(mod as Record<string, unknown>, ["POST", "DELETE"], "/api/lichess/connect");
  });

  it("/api/lichess/sync exports POST", async () => {
    const mod = await import("@/app/api/lichess/sync/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/lichess/sync");
  });

  it("/api/fitbit/auth exports POST", async () => {
    const mod = await import("@/app/api/fitbit/auth/route");
    assertHandlers(mod as Record<string, unknown>, ["POST"], "/api/fitbit/auth");
  });

  it("/api/domain-metrics exports GET", async () => {
    const mod = await import("@/app/api/domain-metrics/route");
    assertHandlers(mod as Record<string, unknown>, ["GET"], "/api/domain-metrics");
  });
});
