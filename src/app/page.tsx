import Link from "next/link";
import {
  Activity,
  Moon,
  Dumbbell,
  Crown,
  Heart,
  Smile,
  ClipboardList,
  Sparkles,
  ArrowRight,
  BarChart3,
  Zap,
  Target,
} from "lucide-react";

// ── Nav ───────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center">
            <Activity className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="font-semibold text-zinc-50 tracking-tight">Life HUD</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-sm font-semibold transition-colors"
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────

function DomainPill({
  icon: Icon,
  label,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${bg}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={color}>{label}</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 text-center">
      <div className="mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          AI-powered · Syncs from wearables · Tracks everything
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-zinc-50 tracking-tight leading-[1.1] mb-6">
          Your life, measured.
          <br />
          <span className="text-blue-400">Your growth, guided.</span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Life HUD aggregates your sleep, fitness, chess, mood, and habits into one
          intelligent dashboard, using AI to surface the patterns that actually matter.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-50 font-medium transition-colors text-base"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold transition-colors text-base"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Domain pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <DomainPill icon={Moon} label="Sleep" color="text-blue-400" bg="bg-blue-500/10 border-blue-500/20" />
          <DomainPill icon={Dumbbell} label="Fitness" color="text-green-400" bg="bg-green-500/10 border-green-500/20" />
          <DomainPill icon={Crown} label="Chess" color="text-amber-400" bg="bg-amber-500/10 border-amber-500/20" />
          <DomainPill icon={Smile} label="Mood" color="text-purple-400" bg="bg-purple-500/10 border-purple-500/20" />
          <DomainPill icon={Heart} label="Recovery" color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/20" />
          <DomainPill icon={ClipboardList} label="Habits" color="text-zinc-300" bg="bg-zinc-800 border-zinc-700" />
        </div>
      </div>
    </section>
  );
}

// ── Section: Every domain. One dashboard. ─────────────────────────────────

function DomainCard({
  icon: Icon,
  name,
  description,
  stat,
  statLabel,
  iconColor,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  stat: string;
  statLabel: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <h3 className="text-sm font-semibold text-zinc-50 mb-1">{name}</h3>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{description}</p>
      <div className="border-t border-zinc-800 pt-3 flex items-baseline gap-1.5">
        <span className={`text-lg font-semibold tabular-nums ${iconColor}`}>{stat}</span>
        <span className="text-xs text-zinc-500">{statLabel}</span>
      </div>
    </div>
  );
}

function DomainsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">Every domain</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-3">
            One dashboard.
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Stop juggling five different apps. Everything about your life - from last night&apos;s sleep to this morning&apos;s workout to your chess rating - in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <DomainCard
            icon={Moon}
            name="Sleep"
            description="Deep sleep, REM cycles, bedtime consistency tracked nightly."
            stat="7h 42m"
            statLabel="last night"
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
          />
          <DomainCard
            icon={Dumbbell}
            name="Fitness"
            description="Auto-logged workouts with heart rate, calories, and intensity."
            stat="4"
            statLabel="workouts this week"
            iconColor="text-green-400"
            iconBg="bg-green-500/10"
          />
          <DomainCard
            icon={Crown}
            name="Chess"
            description="Rating trends, win rates by time control, accuracy by time of day."
            stat="1340"
            statLabel="rapid rating"
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
          />
          <DomainCard
            icon={Smile}
            name="Mood"
            description="Daily check-ins capturing energy, stress, and subjective feel."
            stat="7.2"
            statLabel="avg energy"
            iconColor="text-purple-400"
            iconBg="bg-purple-500/10"
          />
          <DomainCard
            icon={Heart}
            name="Recovery"
            description="HRV and resting heart rate as signals of readiness and adaptation."
            stat="58ms"
            statLabel="avg HRV"
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10"
          />
        </div>
      </div>
    </section>
  );
}

// ── Section: Cross-domain insights ────────────────────────────────────────

interface InsightCardProps {
  text: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
}

function InsightCard({ text, category, categoryColor, categoryBg }: InsightCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${categoryBg}`}>
          <Sparkles className={`w-4 h-4 ${categoryColor}`} />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${categoryColor}`}>{category}</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

function InsightsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">AI-powered</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-4">
            Cross-domain insights
            <br />
            <span className="text-zinc-400">powered by Claude.</span>
          </h2>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            The most interesting patterns in your life live at the intersections. Life HUD connects the dots
            across domains — sleep, fitness, chess, mood — and tells you what&apos;s actually driving your results.
          </p>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Claude AI analyzes weeks of your data, detects correlations humans would miss, and delivers
            actionable insights in plain English — not just charts.
          </p>
        </div>

        <div className="space-y-3">
          <InsightCard
            category="Sleep × Chess"
            categoryColor="text-blue-400"
            categoryBg="bg-blue-500/10"
            text="On days following less than 6.5h of sleep, your blitz accuracy drops by 8% on average. Your sharpest games happen after 7h+ with high deep sleep."
          />
          <InsightCard
            category="Fitness × Recovery"
            categoryColor="text-green-400"
            categoryBg="bg-green-500/10"
            text="Your HRV is 12% higher on rest days that follow a strength session — suggesting your body recovers well from resistance training but needs the off day."
          />
          <InsightCard
            category="Mood × Sleep"
            categoryColor="text-purple-400"
            categoryBg="bg-purple-500/10"
            text="Energy scores above 7 correlate strongly with bedtimes before midnight and at least 45 minutes of REM sleep. Consistency matters more than total hours."
          />
        </div>
      </div>
    </section>
  );
}

// ── Section: Personalized, not generic ────────────────────────────────────

function PersonalizedSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Your baseline", desc: "Insights calibrated to your data, not population averages.", icon: BarChart3, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Your domains", desc: "Enable only the domains that matter to your life.", icon: Target, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Your metrics", desc: "Customize your dashboard to surface what you track most.", icon: Zap, color: "text-green-400", bg: "bg-green-500/10" },
              { label: "Your pace", desc: "Daily check-ins or fully automated — you decide how involved to be.", icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10" },
            ].map(({ label, desc, icon: Icon, color, bg }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-sm font-semibold text-zinc-50 mb-1">{label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">Adaptive</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-4">
            Personalized,
            <br />
            <span className="text-zinc-400">not generic.</span>
          </h2>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Most health apps tell everyone the same things. Life HUD learns your patterns,
            calibrates to your baselines, and gives you insights that are specific to <em className="text-zinc-300 not-italic">your</em> body and life.
          </p>
          <p className="text-zinc-500 text-sm leading-relaxed">
            Whether you&apos;re a night owl, an afternoon athlete, or someone who tracks 20 habits —
            Life HUD adapts to how you live, not the other way around.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Section: Track what matters ────────────────────────────────────────────

function TrackSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-3">Flexible</p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-3">
            Track what matters to you.
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Connect a wearable for automatic sync, or log things manually. Use both. Life HUD works with how you already live.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Wearable sync</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Fitbit, Apple Watch, Garmin, Oura Ring, Whoop — connect once and your data flows in automatically every day.
            </p>
            <p className="text-xs text-zinc-500">Sleep · Steps · HRV · Workouts · Heart rate</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
              <ClipboardList className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Manual tracking</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Log caffeine, screen time, mood, supplements, or any habit you care about. A quick daily form keeps it fast.
            </p>
            <p className="text-xs text-zinc-500">Mood · Energy · Caffeine · Hydration · Habits</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <Crown className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Platform integrations</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Chess.com and Lichess sync your games automatically — rating, accuracy, openings, and time-of-day performance.
            </p>
            <p className="text-xs text-zinc-500">Rating · Win rate · Accuracy · Opening stats</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Bottom CTA ────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center mx-auto mb-6">
          <Activity className="w-7 h-7 text-zinc-950" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-4">
          Start understanding your life.
        </h2>
        <p className="text-zinc-400 mb-8 text-lg leading-relaxed">
          Connect your first data source and get your first AI insight today.
          No credit card required.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-zinc-950 font-semibold text-base transition-colors"
        >
          Get started free <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center">
            <Activity className="w-3 h-3 text-zinc-950" />
          </div>
          <span className="text-sm font-semibold text-zinc-400">Life HUD</span>
        </div>
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} Life HUD. Built with Next.js, Supabase, Terra &amp; Claude.
        </p>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 font-[family-name:var(--font-sora)]">
      <Nav />
      <Hero />
      <DomainsSection />
      <InsightsSection />
      <PersonalizedSection />
      <TrackSection />
      <BottomCTA />
      <Footer />
    </div>
  );
}
