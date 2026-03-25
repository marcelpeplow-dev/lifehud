import { ArchiveGoalButton } from "./ArchiveGoalButton";
import { formatDuration, calcProgress } from "@/lib/utils/metrics";
import { formatRelativeDate } from "@/lib/utils/dates";
import type { Goal, GoalCategory } from "@/types/index";

const CATEGORY_META: Record<GoalCategory, { label: string; color: string }> = {
  sleep:    { label: "Sleep",    color: "text-blue-400 bg-blue-500/10" },
  fitness:  { label: "Fitness",  color: "text-orange-400 bg-orange-500/10" },
  recovery: { label: "Recovery", color: "text-green-400 bg-green-500/10" },
  general:  { label: "General",  color: "text-zinc-400 bg-zinc-700" },
};

function formatCurrentProgress(goal: Goal, currentValue: number): string {
  switch (goal.metric_name) {
    case "sleep_duration":
      return `${formatDuration(currentValue)} / ${formatDuration(goal.target_value)}`;
    case "weekly_workouts":
      return `${currentValue} / ${goal.target_value} workouts`;
    case "steps":
      return `${currentValue.toLocaleString()} / ${goal.target_value.toLocaleString()} steps`;
    default:
      return `${currentValue} / ${goal.target_value} ${goal.target_unit}`;
  }
}

interface GoalCardProps {
  goal: Goal;
  currentValue: number;
}

export function GoalCard({ goal, currentValue }: GoalCardProps) {
  const pct = calcProgress(currentValue, goal.target_value);
  const meta = CATEGORY_META[goal.category];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-md ${meta.color}`}>
            {meta.label}
          </span>
          <h3 className="text-sm font-medium text-zinc-50 truncate">{goal.title}</h3>
        </div>
        <ArchiveGoalButton goalId={goal.id} />
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-400">
            {formatCurrentProgress(goal, currentValue)}
          </span>
          <span className="text-xs font-semibold text-zinc-300 tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-zinc-500 capitalize">
          {goal.target_frequency} · {goal.target_value} {goal.target_unit}
        </span>
        {goal.target_date && (
          <span className="text-xs text-zinc-500">
            Due {formatRelativeDate(goal.target_date)}
          </span>
        )}
      </div>
    </div>
  );
}
