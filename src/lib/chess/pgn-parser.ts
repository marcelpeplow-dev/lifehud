import type { ChessGame } from "@/types/index";

/**
 * Parsed clock data for a single game, extracted from PGN {[%clk H:MM:SS]} annotations.
 */
export interface ParsedClockData {
  /** Clock times (in seconds remaining) for each move, in order. */
  moveTimes: number[];
  /** Time spent on each move (seconds) — derived from clock deltas. */
  moveDeltas: number[];
  /** Starting time (seconds) — inferred from first move clock or time control. */
  startingTime: number;
  /** Final time remaining (seconds). */
  finalTime: number;
  /** Total number of moves parsed. */
  totalMoves: number;
}

/** Regex to match clock annotations: {[%clk H:MM:SS]} or {[%clk M:SS]} */
const CLOCK_REGEX = /\[%clk\s+(\d+):(\d{2}):(\d{2})\]/g;

/**
 * Parse clock times from a PGN string.
 * Returns null if no clock data is found or PGN is null.
 */
export function parseClockData(pgn: string | null): ParsedClockData | null {
  if (!pgn) return null;

  const times: number[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CLOCK_REGEX.source, "g");

  while ((match = regex.exec(pgn)) !== null) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    times.push(hours * 3600 + minutes * 60 + seconds);
  }

  if (times.length < 2) return null;

  // Extract only the player's moves (every other clock annotation)
  // In PGN, clocks alternate: white move clock, black move clock, etc.
  // We'll return all clocks and let the caller filter by player color
  const moveDeltas: number[] = [];
  for (let i = 1; i < times.length; i++) {
    // Time spent = previous remaining - current remaining
    // Can be negative if increment adds time, clamp to 0
    const delta = Math.max(0, times[i - 1] - times[i]);
    moveDeltas.push(delta);
  }

  const startingTime = times.length > 0 ? times[0] : 0;
  const finalTime = times.length > 0 ? times[times.length - 1] : 0;

  return {
    moveTimes: times,
    moveDeltas,
    startingTime: startingTime + (moveDeltas[0] ?? 0), // approximate initial time
    finalTime,
    totalMoves: times.length,
  };
}

/**
 * Extract player-specific clock data from a game.
 * White moves are at even indices (0, 2, 4...), black at odd (1, 3, 5...).
 */
export function getPlayerClockData(
  game: ChessGame,
): ParsedClockData | null {
  const parsed = parseClockData(game.raw_pgn);
  if (!parsed) return null;

  const isWhite = game.player_color === "white";
  const playerTimes = parsed.moveTimes.filter((_, i) =>
    isWhite ? i % 2 === 0 : i % 2 === 1,
  );

  if (playerTimes.length < 2) return null;

  const playerDeltas: number[] = [];
  for (let i = 1; i < playerTimes.length; i++) {
    playerDeltas.push(Math.max(0, playerTimes[i - 1] - playerTimes[i]));
  }

  return {
    moveTimes: playerTimes,
    moveDeltas: playerDeltas,
    startingTime: playerTimes[0] + (playerDeltas[0] ?? 0),
    finalTime: playerTimes[playerTimes.length - 1],
    totalMoves: playerTimes.length,
  };
}

/**
 * Parse time control string (e.g., "600", "180+2", "300+5") into starting seconds.
 */
export function parseTimeControlSeconds(timeControl: string | null): number | null {
  if (!timeControl) return null;
  const match = timeControl.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ── Cache layer ──────────────────────────────────────────────────────────────
// Avoids re-parsing the same PGN across multiple detectors.
const clockCache = new WeakMap<ChessGame, ParsedClockData | null>();

export function getCachedPlayerClock(game: ChessGame): ParsedClockData | null {
  if (clockCache.has(game)) return clockCache.get(game)!;
  const result = getPlayerClockData(game);
  clockCache.set(game, result);
  return result;
}
