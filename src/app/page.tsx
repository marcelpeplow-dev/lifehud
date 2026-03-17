import Link from "next/link";
import {
  Activity,
  Moon,
  Dumbbell,
  Heart,
  Zap,
  Target,
  ArrowRight,
  Watch,
  Brain,
  BarChart3,
} from "lucide-react";

// ── Nav ───────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold transition-colors"
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-semibold text-zinc-50 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 text-center">
      <div className="mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Powered by Claude AI · Syncs from Fitbit, Oura, Garmin, Apple Watch, Whoop
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-zinc-50 tracking-tight leading-[1.1] mb-6">
          Business Intelligence
          <br />
          <span className="text-emerald-400">for your body.</span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Connect your wearable once. Life HUD automatically tracks your sleep,
          fitness, and recovery — then delivers AI coaching insights that actually
          move the needle.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-colors text-base"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-50 font-medium transition-colors text-base"
          >
            Sign in to dashboard
          </Link>
        </div>

        {/* Metric preview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          <MetricPill label="Last night" value="7h 42m" color="bg-blue-500" />
          <MetricPill label="Sleep score" value="84 / 100" color="bg-blue-400" />
          <MetricPill label="Workouts" value="4 this week" color="bg-orange-500" />
          <MetricPill label="HRV" value="54 ms ↑" color="bg-green-500" />
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

function FeatureCard({ icon, title, description, accent }: FeatureCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${accent}`}>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-50 mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-3">
            Everything your wearable data has been hiding
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Raw numbers from your device don&apos;t tell you what to do. Life HUD does.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Moon className="w-5 h-5 text-blue-400" />}
            accent="bg-blue-500/10"
            title="Sleep intelligence"
            description="Deep, REM, and light sleep broken down per night. Understand your patterns, not just your hours."
          />
          <FeatureCard
            icon={<Dumbbell className="w-5 h-5 text-orange-400" />}
            accent="bg-orange-500/10"
            title="Fitness analytics"
            description="Workouts auto-logged with type, duration, calories, and intensity. Every session tracked without lifting a finger."
          />
          <FeatureCard
            icon={<Heart className="w-5 h-5 text-green-400" />}
            accent="bg-green-500/10"
            title="Recovery tracking"
            description="HRV and resting heart rate trends reveal how well your body is adapting to training stress."
          />
          <FeatureCard
            icon={<Brain className="w-5 h-5 text-emerald-400" />}
            accent="bg-emerald-500/10"
            title="AI coaching insights"
            description="Claude AI detects correlations in your data — like how Tuesday's late bedtime tanks Friday's workout — and tells you in plain English."
          />
          <FeatureCard
            icon={<Target className="w-5 h-5 text-amber-400" />}
            accent="bg-amber-500/10"
            title="Smart goals"
            description="Set sleep and workout targets. Life HUD tracks your progress automatically using real data from your wearable."
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5 text-purple-400" />}
            accent="bg-purple-500/10"
            title="Trend analysis"
            description="7, 30, and 90-day views reveal long-term patterns. See whether your habits are actually improving over time."
          />
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5">
      <div className="shrink-0 flex flex-col items-center">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          {icon}
        </div>
        <div className="w-px flex-1 bg-zinc-800 mt-3" />
      </div>
      <div className="pb-10">
        <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">
          Step {number}
        </p>
        <h3 className="text-base font-semibold text-zinc-50 mb-1.5">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-zinc-800/60">
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-4">
            Zero manual tracking.
            <br />
            <span className="text-zinc-400">Seriously.</span>
          </h2>
          <p className="text-zinc-400 mb-8">
            From first login to your first AI insight in under 5 minutes.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-colors"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div>
          <Step
            number="01"
            icon={<Watch className="w-5 h-5 text-zinc-300" />}
            title="Connect your wearable"
            description="Sign up, go through the quick 3-step setup, and link your Fitbit, Apple Watch, Garmin, Oura Ring, or Whoop. Takes about 2 minutes."
          />
          <Step
            number="02"
            icon={<Zap className="w-5 h-5 text-zinc-300" />}
            title="Data syncs automatically"
            description="Sleep, workouts, heart rate, HRV, steps — all pulled in automatically via webhook. No manual exports, no CSV files."
          />
          <Step
            number="03"
            icon={<Brain className="w-5 h-5 text-zinc-300" />}
            title="AI surfaces what matters"
            description="Claude AI analyzes your data, detects patterns across sleep and training, and delivers 2–3 personalized insights per day."
          />
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
        <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-6">
          <Activity className="w-7 h-7 text-zinc-950" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold text-zinc-50 tracking-tight mb-4">
          Ready to understand your body?
        </h2>
        <p className="text-zinc-400 mb-8 text-lg">
          Connect your wearable and get your first AI insight today.
          No credit card required.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-base transition-colors"
        >
          Start for free <ArrowRight className="w-4 h-4" />
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
          <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
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
      <Features />
      <HowItWorks />
      <BottomCTA />
      <Footer />
    </div>
  );
}
