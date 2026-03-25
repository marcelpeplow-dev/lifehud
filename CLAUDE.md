# Life HUD — Fitness MVP

## Commands
- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build
- `npm run lint` — ESLint check

## Architecture
- Next.js 15 with App Router, TypeScript strict mode
- Supabase for auth + PostgreSQL database
- Terra API for wearable data ingestion
- Anthropic Claude API for AI coaching insights
- Recharts for data visualization
- Tailwind CSS 4 for styling

## Conventions
- Server components by default. Use "use client" only for interactivity.
- All API routes in `src/app/api/`
- Database queries via Supabase client (`lib/supabase/server.ts` for server, `lib/supabase/client.ts` for browser)
- Types in `src/types/index.ts` — import from there, don't define inline
- Mobile-first responsive design. Dark mode by default.
- Commit messages: imperative mood, under 72 chars
- No `any` types. Prefer Zod for runtime validation of API responses.
- Keep components under 200 lines. Extract sub-components when larger.
- Error handling: try/catch in API routes, return proper status codes.
- Use `date-fns` for all date manipulation. Store timestamps in UTC.

## Design
- Dark theme: zinc-950 background, zinc-900 cards, emerald-500 accent
- Font: Sora from Google Fonts
- Cards: rounded-xl, p-5, border border-zinc-800
- Category colors: sleep=blue-500, fitness=orange-500, recovery=green-500, correlation=purple-500, goal=amber-500

## Key Directories

### `src/lib/metrics/`
The metric registry system. Every trackable data point is a `MetricDefinition`.

- `registry.ts` — `MetricDefinition[]` covering all ~50 metrics across all domains.
  - Each metric has: `id`, `domain`, `name`, `unit`, `format()`, `inputType`, `healthyRange`, `detectorIds`
  - Helper: `getMetricById(id)`, `getMetricsByDomain(domain)`
- `domains.ts` — `DOMAIN_REGISTRY: DomainDefinition[]` with 10 domains (sleep, fitness, chess, wellbeing, recovery, caffeine, hydration, supplements, screen_time, substances)
  - Each domain: `id`, `name`, `icon`, `color`, `source: "automated" | "manual"`, `defaultMetrics`
  - Helpers: `getDomainById(id)`, `getManualDomains()`, `getAutomatedDomains()`
- `fetch.ts` — `fetchMetricValue(supabase, userId, metricId, period)` — resolves a metric to its current value
- `fetch-series.ts` — time-series data for charts
- `fetch-domain-batch.ts` — batch-fetch all metrics for a domain page
- `index.ts` — re-exports

### `src/lib/analysis/`
The insight detection system.

- `domains.ts` — `Domain` union type: `"sleep" | "fitness" | "chess" | "wellbeing" | "recovery" | "caffeine" | "hydration" | "supplements" | "screen_time" | "substances"`
  - **This is the canonical `Domain` type** — import from here
- `detector-registry.ts` — registers all detectors; `runAllDetectors(bundle)` returns `Insight[]`
- `data-bundle.ts` — `DataBundle` type — the input object passed to all detectors
- `pattern-scorer.ts` — scoring utilities shared across detectors
- `detectors/` — 23 individual detector modules (see below)

### Detector modules (`src/lib/analysis/detectors/`)
One file per domain or cross-domain relationship:
`sleep.ts`, `fitness.ts`, `chess.ts`, `wellbeing.ts`, `mood.ts`, `caffeine.ts`, `hydration.ts`, `screen-time.ts`, `substances.ts`,
`caffeine-sleep.ts`, `chess-mood.ts`, `fitness-chess.ts`, `fitness-mood.ts`, `hydration-fitness.ts`, `hydration-wellbeing.ts`,
`screen-time-sleep.ts`, `screen-time-wellbeing.ts`, `sleep-chess.ts`, `sleep-fitness.ts`, `sleep-mood.ts`,
`substances-sleep.ts`, `supplements-sleep.ts`, `utils.ts`

### Manual Input System
- **Table**: `manual_entries(user_id, date, metric_id, value)` — one row per metric per day
- **Config table**: `user_manual_config(user_id, domain, metric_id, enabled, display_order)` — user's enabled metrics
- **Daily input form**: `src/app/dashboard/daily-input/` — form that reads `user_manual_config` and upserts to `manual_entries`
- **Settings UI**: `src/components/settings/ManualTrackingSection.tsx` — toggle domains/metrics on/off
- **API**: `POST /api/manual-entries`, `GET /api/manual-entries?date=YYYY-MM-DD`
- **API**: `GET/POST/DELETE /api/manual-config`

### Dashboard Customization
- **Table**: `user_dashboard_config(user_id, config_type, position, domain, config)` — persists widget layouts
- Config types: `stat_card` (0-3 positions), `graph` (0-1 positions), `domain_stat_card`, `domain_graph`
- `domain = null` → main dashboard; `domain = "sleep"` → sleep domain page
- Components: `StatCardsSection`, `ConfigurableGraph`, `GraphBuilderModal`, `MetricPickerModal`

## Key Files
- `src/types/index.ts` — all shared TypeScript types
- `src/lib/analysis/domains.ts` — `Domain` union type (canonical)
- `src/lib/metrics/registry.ts` — all metric definitions (~50 metrics)
- `src/lib/metrics/domains.ts` — all domain definitions (10 domains)
- `src/lib/utils/seed.ts` — seed data generator (30 days, cross-domain correlations)
- `src/app/dashboard/layout.tsx` — dashboard shell (Sidebar + MobileNav)
- `src/components/dashboard/Sidebar.tsx` — desktop navigation
- `src/components/dashboard/MobileNav.tsx` — mobile bottom nav
- `supabase/consolidated_schema.sql` — full database schema (documentation)

## Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never expose to client

# Terra API (wearable OAuth)
TERRA_API_KEY=
TERRA_DEV_ID=
TERRA_WEBHOOK_SECRET=            # used to verify incoming Terra webhooks

# Anthropic
ANTHROPIC_API_KEY=               # server-side only

# App
NEXT_PUBLIC_APP_URL=             # e.g. http://localhost:3000

# Optional
SEED_ENABLED=true                # allow /api/seed in production (or use ?secret=lifehud-seed-2024)
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
```

## Important
- NEVER expose SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY to the client
- All AI calls happen server-side only
- Terra webhook handler must verify signatures
- All user data queries must go through Supabase RLS (use anon key on client, service key only in webhooks/seed)
- The `Domain` type is defined in `src/lib/analysis/domains.ts` — do not redefine it inline
