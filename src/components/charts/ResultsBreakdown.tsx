"use client";

interface TimeClassResults {
  timeClass: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

interface ResultsBreakdownProps {
  data: TimeClassResults[];
}

export function ResultsBreakdown({ data }: ResultsBreakdownProps) {
  if (data.length === 0) return <p className="text-sm text-zinc-500">No games in this period.</p>;

  return (
    <div className="space-y-4">
      {data.map((tc) => {
        const winPct = tc.total > 0 ? Math.round((tc.wins / tc.total) * 100) : 0;
        const lossPct = tc.total > 0 ? Math.round((tc.losses / tc.total) * 100) : 0;
        const drawPct = tc.total > 0 ? 100 - winPct - lossPct : 0;

        return (
          <div key={tc.timeClass}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-zinc-200 capitalize">{tc.timeClass}</span>
              <span className="text-xs text-zinc-500">{tc.total} games</span>
            </div>
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
              {winPct > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${winPct}%` }}
                  title={`${winPct}% wins`}
                />
              )}
              {drawPct > 0 && (
                <div
                  className="bg-zinc-500 transition-all"
                  style={{ width: `${drawPct}%` }}
                  title={`${drawPct}% draws`}
                />
              )}
              {lossPct > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${lossPct}%` }}
                  title={`${lossPct}% losses`}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {winPct}% W
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                {drawPct}% D
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {lossPct}% L
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
