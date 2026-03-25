# Life HUD — Full Context Transfer (Updated March 25, 2026)

> Drop this into any new Claude chat to continue with full context.

---

## What this is

Life HUD is a personal analytics platform that aggregates wearable fitness data, chess performance data, manual lifestyle inputs (caffeine, hydration, supplements, screen time, substances), and subjective wellbeing check-ins, then uses AI to generate personalized coaching insights by finding cross-domain correlations. Core thesis: "Business Intelligence for the individual" — the same data-driven frameworks corporations use for KPIs, applied to personal self-improvement.

**Founder:** Marcel Peplow, non-technical solo founder in Vancouver, BC. Building entirely with Claude Code (Sonnet 4.6 for implementation, Opus 4.6 for architecture/strategy). Claude Pro subscription on two accounts (C1 and C2).

**Live site:** https://lifehud.vercel.app
**GitHub:** github.com/marcelpeplow-dev/lifehud
**Tech stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + auth + RLS), Anthropic Claude API (Sonnet), Recharts, Framer Motion, Vitest, deployed on Vercel.

---

## Architecture Overview

The core data model:

```
Data Source → Domain → Metrics → Detectors → Insights → Goals
```

- **Data Source**: Where data comes from (wearable API, chess API, manual input)
- **Domain**: A life area the user tracks (Sleep, Fitness, Chess, Wellbeing, Caffeine, etc.)
- **Metric**: A specific measurable value within a domain (e.g., total sleep duration)
- **Detector**: A function that analyzes one or more metrics to find patterns
- **Insight**: An AI-generated finding from detector output, with rarity tier
- **Goal**: A target value for a specific metric, with auto-progress tracking

Three central registries define the system:
- **Domain Registry** (`src/lib/metrics/domains.ts`): 10 domains with icons, colors, source types
- **Metric Registry** (`src/lib/metrics/registry.ts`): 54 metrics with units, formats, input types, detector cross-references
- **Detector Registry** (`src/lib/analysis/detector-registry.ts`): 80 detectors with required domains, scoring, budget allocation

---

## Current Stats

| Category | Count |
|----------|-------|
| Domains | 10 (4 automated, 6 manual) |
| Metrics | 54 |
| Detectors | 80 (across 23 files) |
| API Routes | 27 |
| Integration Tests | 69 |
| Source Files | 166 |
| Lines of Code | ~23,000 TS/TSX |

---

## Domains

### Automated (data from APIs/wearables)

| Domain | Metrics | Source | Status |
|--------|---------|--------|--------|
| Sleep | 14 | Fitbit, Garmin, Apple Health | Built |
| Fitness | 12 | Fitbit, Garmin, Apple Health | Built |
| Chess | 12 | Chess.com, Lichess | Built |
| Recovery | 0 (uses Sleep/Fitness metrics) | Derived | Built |

### Manual (user daily input)

| Domain | Metrics | Status |
|--------|---------|--------|
| Wellbeing | 5 (mood, energy, stress, focus, journal) | Built |
| Caffeine | 4 (total mg, doses, first/last dose time) | Built |
| Hydration | 1 (water intake) | Built |
| Supplements | 2 (taken toggle, dose) | Built |
| Screen Time | 2 (total, before bed) | Built |
| Substances | 2 (alcohol drinks, cannabis toggle) | Built |

---

## What Has Been Built (all deployed)

### Core Platform
- Landing page with blue accent theme, broad personal analytics positioning
- Auth: email/password + Google OAuth
- Onboarding: 3-step wizard with timezone dropdown, domain selection (not fitness-only), no prefills
- Middleware: auth protection on all dashboard routes
- Seed data system: 30 days across all domains including manual domains with built-in cross-domain correlations

### Metric & Domain Registries
- Central metric registry: 54 metrics, each with id, domain, name, unit, format function, input type, healthy ranges, detector cross-references
- Central domain registry: 10 domains with icons, colors, source type, default metrics
- Helpers: getMetricsByDomain(), getMetricById(), getManualMetrics(), getDomainById()

### Manual Input System
- Database: manual_entries table (generic key-value per metric per day) + user_manual_config table (per-user metric preferences)
- Settings page: Manual Tracking section where users activate domains and toggle individual metrics, with "Used by X detectors" indicators
- Daily Input page: replaces old Check-ins, renders appropriate input widgets per metric type (slider, number, time picker, toggle, stepper, text), grouped by domain
- API routes: /api/manual-config (GET, PUT), /api/manual-entries (GET, POST)
- Data bundle integration: manual data flows into UserDataBundle for detector access

### Dashboard (Customizable)
- 4 configurable stat card slots: click "+" → pick domain → pick metric → shows value + trend
- 2 configurable graph widget slots: graph builder with domain/metric selection, chart type (line/bar/area), time range (7d/30d/90d), dual Y-axis for different units
- Metric fetch utilities: fetchMetricValue() and fetchMetricSeries() route to correct data source based on metric domain
- Dashboard config persisted in user_dashboard_config table
- Goals section shows starred/favorited goals (no duplication bug)
- FAB links to Daily Input page

### Domain Pages (Unified Template)
- DomainPageTemplate component: consistent layout across all domain pages
- 4 domain-scoped stat card slots (auto-filled with defaults)
- 2 configurable graph slots with sensible per-domain defaults
- Full metric table: name, description, today, 7d avg, 30d avg, 90d avg, healthy range indicator
- useDomainMetrics hook: batched data fetching for efficiency
- Domain-specific extras (chess recent games, etc.) render below template

### Sidebar / Navigation
- Restructured with section groupings: Overview, Domains, Tools, System
- Domains visually grouped with icons and colors
- "Daily Input" replaces "Check-ins"
- Import moved into Settings, Sign Out moved into Settings

### Detector Pipeline (Fully Refactored)
- 5-stage pipeline: domain discovery → detector registry → run matching → score & budget → send to AI
- UserDataBundle: all data fetched once in parallel, passed to every detector
- Pattern scorer: significance × novelty × cross-domain bonus, budget allocation with per-domain reserved slots
- Budget sizing: 1 domain = 6 patterns, 2 = 8, 3 = 10, 4+ = 12
- Novelty tracking: detectorId stored in insight metadata, recently-surfaced patterns deprioritized
- Logging: full pipeline summary in console/Vercel logs

### Detector Files (80 total across 23 files)

Within-domain:
- sleep.ts (9), fitness.ts (9), chess.ts (12), wellbeing.ts (6)
- caffeine.ts (2), substances.ts (1), screen-time.ts (1), hydration.ts (1)

Cross-domain:
- sleep-fitness.ts (7), sleep-chess.ts (5), sleep-mood.ts (4)
- fitness-chess.ts (4), fitness-mood.ts (6), chess-mood.ts (7)
- caffeine-sleep.ts (4), substances-sleep.ts (3)
- screen-time-sleep.ts (2), screen-time-wellbeing.ts (1)
- hydration-fitness.ts (1), hydration-wellbeing.ts (2)
- supplements-sleep.ts (2)

### Insight System
- 5 rarity tiers: Common (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold)
- Rising Heat Glow border effects per rarity
- Domain-specific inline icons next to rarity badges
- Legendary-only domain motif animations
- Collapsed/expanded card states with Framer Motion
- 3 action buttons per expanded card: Trend, Action, Connections
- Card pack reveal animation with Web Audio synthesized sounds
- Domain filter pills on insight feed
- Cross-domain insights show multiple domain icons
- "Generate new pack" button, disabled when unread exist
- Max 2 Common insights per pack

### Chess Integration
- Chess.com: connect (username), sync (pulls last 90 days via monthly archives), analytics page with rating trend, results breakdown, time-of-day performance, recent games
- Lichess: connect, sync, client library, settings UI
- Data stored: rating, result, time class, accuracy, opening, PGN, opponent rating
- Chess seed data: 78 games over 30 days

### Goals System (Overhauled)
- 4-step Add Goal modal: Domain → Metric → Target (with current average + healthy range context) → Optional date
- Goals tied to metric registry: domain-aware metric dropdowns, auto-set units, auto-generated titles
- Auto-progress calculation from real metric data
- Star/favorite toggle, archive functionality
- Progress bars color-coded (green/blue/amber/red)
- Goals grouped by domain on Goals page
- Dashboard shows starred goals

### Data Import
- CSV import: Garmin (JSON zip), Fitbit, Apple Health
- Fitbit OAuth 2.0 with PKCE (built, needs end-to-end testing)

### Testing
- Vitest integration tests: 69 tests across 5 files (metric registry, domain registry, detector registry, pattern scorer, API routes)
- Smoke test script: scripts/smoke-test.mjs covers all 27 API routes
- All tests passing, build clean

---

## Database Tables

| Table | Purpose |
|-------|---------|
| auth.users | Supabase auth (email/password + Google OAuth) |
| profiles | User profile (name, DOB, height, weight, timezone) |
| sleep_records | Nightly sleep data from wearables |
| workouts | Workout sessions from wearables |
| daily_metrics | Daily aggregated metrics (steps, calories, HR, HRV) |
| chess_games | Chess game records (Chess.com + Lichess) |
| daily_checkins | Legacy mood/energy/stress check-ins (kept for backward compat) |
| manual_entries | Generic manual metric entries (user_id, date, metric_id, value) |
| user_manual_config | Per-user manual domain/metric preferences |
| user_dashboard_config | Per-user dashboard stat card and graph widget configs |
| user_integrations | Connected service tokens (Fitbit OAuth, chess usernames) |
| insights | AI-generated insights with rarity, domains, detector metadata |
| goals | User goals tied to metric registry |

---

## Environment Variables (all set in Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://mnjojpflcadceewqbsnz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(set)
SUPABASE_SERVICE_ROLE_KEY=(set — was rotated after early exposure)
ANTHROPIC_API_KEY=(set)
FITBIT_CLIENT_ID=23V8QF
FITBIT_CLIENT_SECRET=(set)
FITBIT_REDIRECT_URI=https://lifehud.vercel.app/api/fitbit/callback
NEXT_PUBLIC_APP_URL=https://lifehud.vercel.app
```

---

## Key Files

```
CLAUDE.md                                        — project conventions
CONTEXT_TRANSFER.md                              — this file

src/lib/metrics/registry.ts                      — central metric registry (54 metrics)
src/lib/metrics/domains.ts                       — central domain registry (10 domains)
src/lib/metrics/index.ts                         — re-exports
src/lib/metrics/fetch.ts                         — fetchMetricValue() utility
src/lib/metrics/fetch-series.ts                  — fetchMetricSeries() utility

src/lib/analysis/domains.ts                      — Domain type + discoverActiveDomains()
src/lib/analysis/detector-registry.ts            — DetectorDefinition, registry, getApplicableDetectors()
src/lib/analysis/data-bundle.ts                  — UserDataBundle fetch (parallel, includes manual data)
src/lib/analysis/pattern-scorer.ts               — scoring + budget allocation
src/lib/analysis/detectors/                      — 23 detector files (80 detectors total)
src/lib/analysis/detectors/index.ts              — imports all detector files

src/lib/ai/generate.ts                           — Claude API calls for insight generation
src/app/api/insights/generate/route.ts           — main generation endpoint
src/app/api/insights/[id]/ask/route.ts           — action button API (Trend/Action/Connections)

src/app/api/manual-config/route.ts               — manual domain/metric preferences API
src/app/api/manual-entries/route.ts              — manual metric data entry API
src/app/api/dashboard-config/route.ts            — dashboard widget config API
src/app/api/metric-value/route.ts                — single metric value fetch API
src/app/api/metric-series/route.ts               — metric time series fetch API

src/app/api/chess/connect/route.ts               — Chess.com connection
src/app/api/chess/sync/route.ts                  — Chess.com data sync
src/app/api/lichess/connect/route.ts             — Lichess connection
src/app/api/lichess/sync/route.ts                — Lichess data sync
src/lib/chess/client.ts                          — Chess.com API client
src/lib/lichess/client.ts                        — Lichess API client

src/components/dashboard/ConfigurableStatCard.tsx — customizable stat cards
src/components/dashboard/ConfigurableGraph.tsx    — customizable graph widgets
src/components/dashboard/MetricPickerModal.tsx    — domain → metric selection modal
src/components/dashboard/GraphBuilderModal.tsx    — graph configuration modal
src/components/domain/DomainPageTemplate.tsx      — unified domain page layout
src/components/insights/PackRevealModal.tsx       — card pack reveal animation
src/components/insights/useRevealSound.ts         — Web Audio sounds

src/hooks/useDomainMetrics.ts                    — batched domain metric data fetching

src/app/dashboard/daily-input/page.tsx           — manual daily input form
src/app/dashboard/goals/page.tsx                 — goals page with domain grouping
src/app/dashboard/sleep/page.tsx                 — sleep domain page (uses template)
src/app/dashboard/fitness/page.tsx               — fitness domain page (uses template)
src/app/dashboard/chess/page.tsx                 — chess domain page (uses template)

src/__tests__/integration/                       — 69 integration tests
scripts/smoke-test.mjs                           — API route smoke test

supabase/schema.sql                              — original schema
supabase/consolidated_schema.sql                 — full current schema (all tables)
supabase/*.sql                                   — individual migrations
```

---

## Decisions Made

- **No Terra API** — $500/month too expensive. Using CSV import + direct Fitbit OAuth instead.
- **Blue accent theme** — changed from emerald/green to blue-500 electric blue
- **"Wellbeing" not "mood"** — domain name unified across codebase, covers mood + energy + stress + focus + journal
- **Metric registry is the spine** — every feature (dashboard, goals, manual input, detectors) builds on the central metric registry
- **Manual domains are high-leverage** — small input burden, disproportionately powerful for cross-domain insights (caffeine alone unlocks 4 sleep detectors)
- **Hybrid manual input** — curated metric list per domain (tied to detectors), users select which to track. Not fully open-ended.
- **Cross-domain insights are the moat** — nobody else has chess + sleep + caffeine + mood + fitness in one place. Cross-domain detectors get a 1.5-2x score bonus.
- **Sonnet 4.6 for Claude Code** — handles 90%+ of implementation tasks. Opus for architecture/strategy only.
- **Dark theme** — zinc-950 background, zinc-900 cards, blue-500 accent, Sora font
- **Price point** — $12-15/month ($120-150/year), below Gyroscope ($299/yr), above Exist ($84/yr)
- **Detector budget** — 80 detectors, top 8-12 selected per generation based on significance × novelty × cross-domain bonus

---

## Known Issues / To-Do

- [ ] Manual QA pass needed on live site (QA_CHECKLIST_FULL.md created, not yet executed)
- [ ] Fitbit OAuth never tested end-to-end on live site
- [ ] Garmin JSON zip import needs testing with real Garmin export
- [ ] Google OAuth consent screen still shows Supabase URL (needs Google Cloud Console update — instructions in docs/GOOGLE_OAUTH_FIX.md)
- [ ] Supabase service_role key was exposed in an early chat — has been rotated but worth monitoring
- [ ] Recovery domain has no direct metrics (derives from sleep/fitness) — may need rethinking
- [ ] Supplements tracking is basic (global toggle, not per-supplement) — needs per-supplement configuration
- [ ] No notification/push system yet
- [ ] No billing/payments yet

---

## Competitive Landscape

- **Gyroscope** ($299/yr) — closest competitor, health-only, has AI coach. No skills/cognitive domains.
- **Exist** ($84/yr) — cross-service correlations, no AI coaching.
- **Whoop/Oura** — single-device ecosystems, no multi-source aggregation.
- **Strategic gap:** nobody does automated + multi-domain + manual lifestyle + AI coaching + gamified delivery (rarity/pack system) + cognitive domains (chess).

---

## Workflow

- **Claude Chat (Opus 4.6 extended):** Strategic advisor, architecture design, prompt generation, decision-making
- **Claude Code (Sonnet 4.6):** Engineering implementation. Launch with `claude --dangerously-skip-permissions`
- **Claude Code context:** CLAUDE.md in project root. Start each session with "read CLAUDE.md"
- **Claude in Chrome (Sonnet 4.6):** Browser QA testing
- **Founder:** Manual testing, user recruitment, business decisions

---

## What's Next (potential priorities)

1. **Manual QA** — go through QA_CHECKLIST_FULL.md on live site, fix bugs
2. **Social features** — add friends, accountability, challenges, leaderboards
3. **Notifications** — push insights to users (email, push, in-app)
4. **Billing** — Stripe integration for $12-15/month subscription
5. **Suggested goals** — AI-generated goal recommendations based on user data
6. **Habit tracking** — maintenance-based goals as proper habits with streaks
7. **"Baseline" rebrand** — potential rename from Life HUD
8. **Per-supplement tracking** — individual supplement configuration and per-supplement detectors
9. **More data sources** — Apple Health direct API, Strava, Oura
10. **Synthetic metrics** — AI-inferred metrics (e.g., "opening sharpness" from chess data)
