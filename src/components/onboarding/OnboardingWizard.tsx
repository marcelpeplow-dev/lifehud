"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { StepProfile, type ProfileData } from "./StepProfile";
import { StepGoals, type GoalsData } from "./StepGoals";
import { StepDevice } from "./StepDevice";

const STEPS = ["Profile", "Goals", "Device"];

const DEFAULT_PROFILE: ProfileData = {
  display_name: "",
  date_of_birth: "",
  height_cm: "",
  weight_kg: "",
  timezone: "",
};

const DEFAULT_GOALS: GoalsData = {
  sleep_target_minutes: 480,
  weekly_workouts_target: 4,
};

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current ? "w-6 bg-emerald-500" : i < current ? "w-3 bg-emerald-500/50" : "w-3 bg-zinc-700"
          }`}
        />
      ))}
      <span className="text-xs text-zinc-500 ml-1">
        {current + 1} / {total}
      </span>
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [goals, setGoals] = useState<GoalsData>(DEFAULT_GOALS);
  const [connecting, setConnecting] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-detect timezone on mount
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setProfile((p) => ({ ...p, timezone: p.timezone || tz }));
  }, []);

  async function complete() {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: profile.display_name,
        date_of_birth: profile.date_of_birth || null,
        height_cm: profile.height_cm ? Number(profile.height_cm) : null,
        weight_kg: profile.weight_kg ? Number(profile.weight_kg) : null,
        timezone: profile.timezone,
        sleep_target_minutes: goals.sleep_target_minutes,
        weekly_workouts_target: goals.weekly_workouts_target,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/dashboard");
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setDeviceError(null);
    try {
      const res = await fetch("/api/terra/auth", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not get widget URL");
      // Open widget in a new tab
      window.open(data.url, "_blank", "noopener,noreferrer");
      // Complete onboarding after opening (device connection happens async via webhook)
      await complete();
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : "Failed to connect device.");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Activity className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="text-sm font-semibold text-zinc-50">Life HUD</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
            {STEPS[step]}
          </p>
          <StepDots current={step} total={STEPS.length} />
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {step === 0 && (
            <StepProfile
              data={profile}
              onChange={setProfile}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <StepGoals
              data={goals}
              onChange={setGoals}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepDevice
              onConnect={handleConnect}
              onSkip={complete}
              onBack={() => setStep(1)}
              connecting={connecting || submitting}
              error={deviceError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
