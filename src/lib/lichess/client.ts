const LICHESS_BASE = "https://lichess.org/api";

const HEADERS: HeadersInit = {
  "User-Agent": "Life-HUD/1.0 (lifehud.vercel.app)",
  Accept: "application/json",
};

// ============================================================
// Lichess API response types
// ============================================================

export interface LichessUser {
  id: string;
  username: string;
  url: string;
  createdAt: number;
  seenAt: number;
  perfs: Record<string, LichessPerf>;
  count: {
    all: number;
    rated: number;
    win: number;
    loss: number;
    draw: number;
  };
}

export interface LichessPerf {
  games: number;
  rating: number;
  rd: number;
  prog: number;
}

export interface LichessGamePlayer {
  user?: { name: string; id: string };
  rating: number;
  ratingDiff?: number;
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: {
    white: LichessGamePlayer;
    black: LichessGamePlayer;
  };
  winner?: "white" | "black";
  opening?: { eco: string; name: string; ply: number };
  moves?: string;
  clocks?: number[];
}

// ============================================================
// Parsed game row (matches chess_games table)
// ============================================================

export interface ParsedLichessGame {
  game_id: string;
  played_at: string; // ISO timestamp
  date: string; // YYYY-MM-DD
  time_class: string;
  time_control: string | null;
  player_color: "white" | "black";
  player_rating: number;
  opponent_rating: number;
  result: "win" | "loss" | "draw";
  result_detail: string | null;
  accuracy: number | null;
  num_moves: number | null;
  duration_seconds: number | null;
  opening_name: string | null;
  raw_pgn: string | null;
  source: "lichess";
}

// ============================================================
// API fetch helpers
// ============================================================

async function lichessFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${LICHESS_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Lichess API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch a Lichess user profile. Returns null if username does not exist. */
export async function getUser(username: string): Promise<LichessUser | null> {
  try {
    return await lichessFetch<LichessUser>(`/user/${encodeURIComponent(username.toLowerCase())}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

/**
 * Fetch recent rated games for a user (NDJSON format).
 * Returns up to `max` games, most recent first.
 * If `since` is provided, only returns games played after that Unix ms timestamp.
 */
export async function getRecentGames(
  username: string,
  options: { max?: number; since?: number } = {},
): Promise<LichessGame[]> {
  const params = new URLSearchParams({
    max: String(options.max ?? 200),
    rated: "true",
    pgnInBody: "false",
    clocks: "true",
    opening: "true",
  });
  if (options.since) {
    params.set("since", String(options.since));
  }

  const url = `${LICHESS_BASE}/games/user/${encodeURIComponent(username.toLowerCase())}?${params}`;
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      Accept: "application/x-ndjson",
    },
  });

  if (!res.ok) {
    throw new Error(`Lichess API error ${res.status}: ${await res.text()}`);
  }

  const text = await res.text();
  if (!text.trim()) return [];

  // Parse NDJSON (one JSON object per line)
  const games: LichessGame[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      games.push(JSON.parse(trimmed) as LichessGame);
    } catch {
      // Skip malformed lines
    }
  }

  return games;
}

// ============================================================
// Map Lichess speed to our time_class
// ============================================================

function mapTimeClass(speed: string): string {
  switch (speed) {
    case "ultraBullet":
    case "bullet":
      return "bullet";
    case "blitz":
      return "blitz";
    case "rapid":
      return "rapid";
    case "classical":
    case "correspondence":
      return "daily";
    default:
      return speed;
  }
}

/** Map Lichess status string to a human-readable detail. */
function resultDetail(status: string, winner?: string): string | null {
  const map: Record<string, string> = {
    mate: "checkmate",
    resign: "resignation",
    outoftime: "timeout",
    stalemate: "stalemate",
    draw: "draw by agreement",
    timeout: "timeout",
    noStart: "no start",
    cheat: "cheat detected",
    variantEnd: "variant end",
  };
  if (!winner && status !== "stalemate") return "draw";
  return map[status] ?? status;
}

// ============================================================
// Parse a Lichess game into our database row format
// ============================================================

export function parseGame(game: LichessGame, username: string): ParsedLichessGame | null {
  // Only standard chess
  if (game.variant !== "standard") return null;

  const lowerUsername = username.toLowerCase();
  const isWhite = game.players.white.user?.id?.toLowerCase() === lowerUsername;
  const isBlack = game.players.black.user?.id?.toLowerCase() === lowerUsername;

  if (!isWhite && !isBlack) return null;

  const playerSide = isWhite ? game.players.white : game.players.black;
  const opponentSide = isWhite ? game.players.black : game.players.white;
  const playerColor: "white" | "black" = isWhite ? "white" : "black";

  // Determine result
  let result: "win" | "loss" | "draw";
  if (!game.winner) {
    result = "draw";
  } else if (game.winner === playerColor) {
    result = "win";
  } else {
    result = "loss";
  }

  const playedAt = new Date(game.createdAt);
  const endedAt = new Date(game.lastMoveAt);
  const durationSeconds = Math.round((endedAt.getTime() - playedAt.getTime()) / 1000);

  // Count moves from move string
  let numMoves: number | null = null;
  if (game.moves) {
    const moveTokens = game.moves.trim().split(/\s+/);
    numMoves = Math.ceil(moveTokens.length / 2);
  }

  return {
    game_id: `lichess:${game.id}`,
    played_at: playedAt.toISOString(),
    date: playedAt.toISOString().split("T")[0],
    time_class: mapTimeClass(game.speed),
    time_control: game.speed,
    player_color: playerColor,
    player_rating: playerSide.rating,
    opponent_rating: opponentSide.rating,
    result,
    result_detail: resultDetail(game.status, game.winner),
    accuracy: null, // Lichess API doesn't provide accuracy
    num_moves: numMoves,
    duration_seconds: durationSeconds > 0 ? durationSeconds : null,
    opening_name: game.opening?.name ?? null,
    raw_pgn: null,
    source: "lichess",
  };
}
