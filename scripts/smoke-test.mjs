#!/usr/bin/env node
/**
 * Smoke test — verifies all API endpoints respond without crashing.
 *
 * Usage:
 *   node scripts/smoke-test.mjs [BASE_URL]
 *
 * BASE_URL defaults to http://localhost:3000
 *
 * A route is considered PASSING if it returns any HTTP status that is NOT 5xx.
 * Unauthenticated requests returning 401/403 are a PASS (auth guard is working).
 * 404 means the route doesn't exist — investigate.
 */

const BASE_URL = process.argv[2] ?? "http://localhost:3000";

const routes = [
  // Manual input
  { method: "GET",    path: "/api/manual-config" },
  { method: "PUT",    path: "/api/manual-config",    body: { configs: [] } },
  { method: "GET",    path: "/api/manual-entries?date=2024-01-01" },
  { method: "POST",   path: "/api/manual-entries",   body: { entries: [] } },

  // Dashboard config
  { method: "GET",    path: "/api/dashboard-config" },
  { method: "PUT",    path: "/api/dashboard-config", body: {} },
  { method: "DELETE", path: "/api/dashboard-config?config_type=stat_card&position=0" },

  // Insights
  { method: "POST",   path: "/api/insights/generate", body: {} },

  // Metrics
  { method: "GET",    path: "/api/metric-value?metricId=sleep_total_duration&period=7d" },
  { method: "GET",    path: "/api/metric-series?metricId=sleep_total_duration&period=30d" },
  { method: "GET",    path: "/api/domain-metrics?domain=sleep" },

  // Check-ins
  { method: "GET",    path: "/api/checkins" },
  { method: "POST",   path: "/api/checkins",         body: { date: "2024-01-01", mood: 7, energy: 6, stress: 4 } },

  // Goals
  { method: "POST",   path: "/api/goals",            body: {} },
  { method: "PATCH",  path: "/api/goals/00000000-0000-0000-0000-000000000000", body: {} },

  // Daily action
  { method: "POST",   path: "/api/daily-action",     body: {} },

  // Chess
  { method: "POST",   path: "/api/chess/connect",    body: { username: "test" } },
  { method: "POST",   path: "/api/chess/sync",        body: {} },

  // Lichess
  { method: "POST",   path: "/api/lichess/connect",  body: { username: "test" } },
  { method: "POST",   path: "/api/lichess/sync",      body: {} },

  // Fitbit
  { method: "POST",   path: "/api/fitbit/auth",       body: {} },
  { method: "GET",    path: "/api/fitbit/callback?code=test&state=test" },

  // Import
  { method: "POST",   path: "/api/import/confirm",   body: { sleep: [], workouts: [], metrics: [], source: "garmin_csv" } },
  { method: "DELETE", path: "/api/import/clear" },

  // Seed (requires secret or SEED_ENABLED)
  { method: "GET",    path: "/api/seed?secret=lifehud-seed-2024" },

  // Auth
  { method: "GET",    path: "/api/auth/callback?code=test" },
];

async function run() {
  console.log(`\nSmoke test against: ${BASE_URL}\n`);
  console.log("─".repeat(60));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const route of routes) {
    const url = `${BASE_URL}${route.path}`;
    const options = {
      method: route.method,
      headers: { "Content-Type": "application/json" },
    };
    if (route.body && !["GET", "HEAD", "DELETE"].includes(route.method)) {
      options.body = JSON.stringify(route.body);
    }

    try {
      const res = await fetch(url, options);
      const status = res.status;
      const isPass = status < 500;

      if (isPass) {
        passed++;
        const label =
          status === 401 || status === 403 ? "AUTH" :
          status === 404 ? "404 " :
          status === 422 ? "422 " :
          "OK  ";
        console.log(`  ✅ ${label} ${route.method.padEnd(7)} ${route.path} (${status})`);
      } else {
        failed++;
        let body = "";
        try { body = await res.text(); } catch { /* ignore */ }
        const snippet = body.slice(0, 100).replace(/\n/g, " ");
        console.log(`  ❌ FAIL ${route.method.padEnd(7)} ${route.path} (${status}: ${snippet})`);
        failures.push({ route, status, body: snippet });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ERR  ${route.method.padEnd(7)} ${route.path} (${msg})`);
      failures.push({ route, status: 0, body: msg });
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed (${routes.length} total)\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  • ${f.route.method} ${f.route.path} → ${f.status}: ${f.body}`);
    }
    console.log();
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Smoke test runner crashed:", err);
  process.exit(1);
});
