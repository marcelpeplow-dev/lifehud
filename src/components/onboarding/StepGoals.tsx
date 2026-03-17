import { ArrowLeft, ArrowRight } from "lucide-react";

export interface GoalsData {
  sleep_target_minutes: number;
  weekly_workouts_target: number;
}

interface Props {
  data: GoalsData;
  onChange: (data: GoalsData) => void;
  onNext: () => void;
  onBack: () => void;
}

const SLEEP_OPTIONS = [
  { label: "6h", minutes: 360 },
  { label: "6.5h", minutes: 390 },
  { label: "7h", minutes: 420 },
  { label: "7.5h", minutes: 450 },
  { label: "8h", minutes: 480 },
  { label: "9h", minutes: 540 },
];

const WORKOUT_OPTIONS = [2, 3, 4, 5, 6];

export function StepGoals({ data, onChange, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50 mb-1">Set your targets</h2>
        <p className="text-sm text-zinc-400">These become your baseline goals. You can change them anytime.</p>
      </div>

      {/* Sleep goal */}
      <div>
        <p className="text-sm font-medium text-zinc-200 mb-3">How much sleep do you aim for?</p>
        <div className="flex gap-2 flex-wrap">
          {SLEEP_OPTIONS.map((o) => (
            <button
              key={o.minutes}
              type="button"
              onClick={() => onChange({ ...data, sleep_target_minutes: o.minutes })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                data.sleep_target_minutes === o.minutes
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workout goal */}
      <div>
        <p className="text-sm font-medium text-zinc-200 mb-3">How many workouts per week?</p>
        <div className="flex gap-2">
          {WORKOUT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...data, weekly_workouts_target: n })}
              className={`w-12 h-12 rounded-lg text-sm font-semibold transition-colors ${
                data.weekly_workouts_target === n
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-zinc-800/60 rounded-xl p-4 text-sm text-zinc-400 space-y-1">
        <p>
          <span className="text-zinc-50 font-medium">Sleep goal: </span>
          {Math.round(data.sleep_target_minutes / 60 * 10) / 10} hours per night
        </p>
        <p>
          <span className="text-zinc-50 font-medium">Workout goal: </span>
          {data.weekly_workouts_target} sessions per week
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-colors"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
