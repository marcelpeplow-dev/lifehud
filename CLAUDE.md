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

## Important
- NEVER expose SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY to the client
- All AI calls happen server-side only
- Terra webhook handler must verify signatures
- All user data queries must go through Supabase RLS (use anon key on client, service key only in webhooks)
