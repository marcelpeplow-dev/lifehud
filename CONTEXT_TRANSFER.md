# Life HUD — Context Transfer Document
*Last updated: 2026-03-25*

## What Is This?
A personal health intelligence dashboard. It ingests data from wearables, chess platforms, and manual daily logs, then runs pattern-detection algorithms to surface insights about cross-domain correlations (e.g. "you play 12% better chess after 7.5h sleep", "late caffeine reduces your HRV").

---

## What's Been Built

### Core Infrastructure
- **Next.js 15 App Router** with TypeScript strict mode, Tailwind CSS 4, Supabase (auth + Postgres)
- **Authentication** — Supabase email/password with onboarding flow
- **Row Level Security** — all user data protected at DB level
- **Dark theme** — zinc-950 background, Sora font

### Data Ingestion
| Source | Method | Status |
|--------|--------|--------|
| Fitbit | OAuth (direct API) | ✅ |
| Chess.com | API polling | ✅ |
| Lichess | API polling | ✅ |
| Garmin | CSV import | ✅ |
| Fitbit (CSV) | ZIP import | ✅ |
| Apple Health | CSV import (QS Access) | ✅ |
| Terra (other wearables) | Webhook | ✅ |
| Manual entry | Daily input form | ✅ |

### Domain Pages
- **Sleep** (`/dashboard/sleep`) — sleep duration, efficiency, stages, HRV, charts
- **Fitness** (`/dashboard/fitness`) — workouts, steps, active minutes, resting HR
- **Chess** (`/dashboard/chess`) — rating trends, accuracy, game history, opening stats

### Manual Tracking System (Phase 2B)
6 manual domains, all with configurable metrics:
| Domain | Key Metrics |
|--------|-------------|
| Wellbeing | Mood, energy, stress, focus (1-10 scales) |
| Caffeine | Total mg/day, doses, first/last dose time |
| Hydration | Water intake (liters) |
| Supplements | Taken (toggle), dose count |
| Screen Time | Total hours, before-bed hours |
| Substances | Alcohol units, cannabis (toggle) |

- **Daily Input** (`/dashboard/daily-input`) — renders enabled metrics as form inputs
- **Settings** — toggle which domains/metrics are active via `ManualTrackingSection`
- **Tables**: `manual_entries`, `user_manual_config`

### Insight Detection System
**23 detector modules**, ~31 total detectors registered:

| File | What it detects |
|------|----------------|
| `sleep.ts` | Sleep debt, poor efficiency, inconsistent schedule, late nights |
| `fitness.ts` | Training gaps, streak tracking, overtraining risk |
| `chess.ts` | Rating trends, accuracy, blunder patterns |
| `wellbeing.ts` | Mood/energy/stress trend changes |
| `mood.ts` | Mood volatility, sustained low mood |
| `caffeine.ts` | High intake, late consumption risk |
| `hydration.ts` | Dehydration risk, trend |
| `screen-time.ts` | High total, late-night exposure |
| `substances.ts` | Alcohol frequency, high-dose days |
| `caffeine-sleep.ts` | Late caffeine → sleep efficiency correlation |
| `chess-mood.ts` | Mood → chess accuracy correlation |
| `fitness-chess.ts` | Workout → chess performance correlation |
| `fitness-mood.ts` | Exercise → energy correlation |
| `hydration-fitness.ts` | Hydration → workout quality correlation |
| `hydration-wellbeing.ts` | Water intake → energy correlation |
| `screen-time-sleep.ts` | Pre-bed screen → sleep latency correlation |
| `screen-time-wellbeing.ts` | Screen time → stress/focus correlation |
| `sleep-chess.ts` | Sleep → chess accuracy/rating correlation |
| `sleep-fitness.ts` | Sleep → workout performance correlation |
| `sleep-mood.ts` | Sleep → mood/energy correlation |
| `substances-sleep.ts` | Alcohol → REM/HRV impact |
| `supplements-sleep.ts` | Supplement consistency → sleep quality |

Insights have a **rarity system**: common → uncommon → rare → epic → legendary (based on data significance).

### Goals System
- Multi-step wizard (domain → metric → target → date)
- Backed by `MetricDefinition` registry — real-time progress tracking
- Grouped by domain on goals page
- Star/archive actions
- Dashboard shows top 4 starred goals

### Dashboard Customization
- **4 stat cards** (positions 0-3) — each picker from any metric in the registry
- **2 graph widgets** (positions 0-1) — configurable time-series or bar charts
- Persisted in `user_dashboard_config` table per user
- Works on main dashboard and per-domain pages

### Daily Check-ins + Streak
- Quick mood/energy/stress log (1-10)
- Streak tracking (shown with flame icon)
- Influences `wellbeing_*` data available to detectors

### Daily Action Card
- AI-generated coaching prompt (Claude Sonnet) shown at top of dashboard
- One per user per day, stored in `daily_actions`

### Seed Data System
- `GET /api/seed` — seeds current signed-in user
- `POST /api/seed` — seeds arbitrary `user_id` (admin use)
- `?secret=lifehud-seed-2024` bypass for production
- Generates 30 days of realistic data across **all domains** with cross-domain correlations baked in:
  - Late caffeine → reduced sleep efficiency
  - Alcohol → reduced REM + HRV
  - Good hydration → energy bump
  - Screen time before bed → longer sleep latency

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile (extends auth.users) |
| `device_connections` | Terra wearable connections |
| `user_integrations` | OAuth integrations (Fitbit) |
| `sleep_records` | Nightly sleep data |
| `workouts` | Individual workout sessions |
| `daily_metrics` | Daily aggregates (steps, HR, HRV) |
| `chess_games` | Chess.com + Lichess game history |
| `insights` | AI-generated insights with rarity |
| `daily_checkins` | Daily mood/energy/stress check-ins |
| `goals` | User goals with domain/metric tracking |
| `daily_actions` | Daily AI coaching prompts |
| `user_dashboard_config` | Customizable widget layouts |
| `manual_entries` | Manual metric entries (key-value per day) |
| `user_manual_config` | User's enabled manual metrics |

Full schema: `supabase/consolidated_schema.sql`

---

## Domain + Metric Counts
- **10 domains**: sleep, fitness, chess, wellbeing, recovery, caffeine, hydration, supplements, screen_time, substances
- **~50 metric definitions** in `src/lib/metrics/registry.ts`
- **5 automated domains** (data from wearables/APIs)
- **5 manual domains** (data from daily input form)

---

## Key Files

```
src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx              Main dashboard
│   │   ├── layout.tsx            Shell with Sidebar + MobileNav
│   │   ├── sleep/                Sleep domain page
│   │   ├── fitness/              Fitness domain page
│   │   ├── chess/                Chess domain page
│   │   ├── daily-input/          Manual metrics entry form
│   │   ├── insights/             Insights list + AI ask
│   │   ├── goals/                Goals management
│   │   ├── checkins/             Check-in history
│   │   └── settings/             Settings (profile, data sources, account)
│   └── api/
│       ├── seed/                 Seed data endpoint
│       ├── insights/generate/    AI insight generation
│       ├── metric-value/         Single metric current value
│       ├── metric-series/        Time-series for charts
│       ├── manual-entries/       CRUD for manual_entries
│       ├── manual-config/        CRUD for user_manual_config
│       ├── goals/                Goals CRUD
│       ├── chess/connect|sync    Chess.com integration
│       ├── lichess/connect|sync  Lichess integration
│       ├── fitbit/               Fitbit OAuth flow
│       ├── import/               CSV import confirm/clear
│       └── dashboard-config/     Widget config persistence
├── lib/
│   ├── metrics/
│   │   ├── registry.ts           ~50 MetricDefinition objects
│   │   ├── domains.ts            10 DomainDefinition objects
│   │   ├── fetch.ts              Single metric value resolver
│   │   ├── fetch-series.ts       Time-series resolver
│   │   └── fetch-domain-batch.ts Batch domain metric fetch
│   ├── analysis/
│   │   ├── domains.ts            Domain union type (canonical)
│   │   ├── detector-registry.ts  Runs all detectors
│   │   ├── data-bundle.ts        DataBundle type
│   │   └── detectors/            23 detector modules
│   └── utils/
│       └── seed.ts               Seed data generator
├── components/
│   ├── dashboard/                Sidebar, MobileNav, StatCards, ConfigurableGraph
│   ├── settings/                 ProfileForm, ManualTrackingSection, device cards
│   ├── import/                   ImportFlow (CSV import UI)
│   ├── goals/                    GoalCard, AddGoalModal
│   ├── charts/                   SleepChart, ActivityChart, domain charts
│   └── domain/                   Domain stat + graph widget components
└── types/index.ts                All shared TypeScript types
```

---

## What's Next / Remaining
- **Mobile app** — React Native or PWA wrapper
- **Notification system** — push alerts for anomalies (e.g. sleep debt building)
- **Weekly digest email** — AI-generated summary sent Monday mornings
- **More domain pages** — dedicated pages for Wellbeing, Caffeine, Substances (currently only Sleep/Fitness/Chess have dedicated pages)
- **Social / accountability** — share goals or weekly summary with a friend
- **Prediction engine** — given today's data, forecast tonight's sleep score
- **Insight history** — archive of all past insights, not just undismissed
