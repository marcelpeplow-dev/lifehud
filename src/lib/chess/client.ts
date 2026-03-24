const CHESS_BASE = "https://api.chess.com/pub";

const HEADERS: HeadersInit = {
  "User-Agent": "Life HUD (lifehud.vercel.app)",
  Accept: "application/json",
};

// ============================================================
// Chess.com API response types
// ============================================================

export interface ChessPlayer {
  player_id: number;
  url: string;
  username: string;
  name?: string;
  avatar?: string;
  last_online: number;
  joined: number;
  country: string;
  status: string;
}

export interface ChessRatingStats {
  last: { rating: number; date: number };
  best?: { rating: number; date: number };
  record: { win: number; loss: number; draw: number };
}

export interface ChessPlayerStats {
  chess_rapid?: ChessRatingStats;
  chess_blitz?: ChessRatingStats;
  chess_bullet?: ChessRatingStats;
  chess_daily?: ChessRatingStats;
  [key: string]: ChessRatingStats | undefined;
}

export interface ChessGamePlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChessGameRaw {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string;
  rules: string;
  white: ChessGamePlayer;
  black: ChessGamePlayer;
}

export interface ChessArchivesResponse {
  archives: string[];
}

export interface ChessMonthlyGamesResponse {
  games: ChessGameRaw[];
}

// ============================================================
// Parsed game row (matches chess_games table)
// ============================================================

export interface ParsedChessGame {
  game_id: string;
  played_at: string;   // ISO timestamp
  date: string;        // YYYY-MM-DD
  time_class: string;
  time_control: string;
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
  source: "chess.com";
}

// ============================================================
// API fetch helpers
// ============================================================

async function chessFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CHESS_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Chess.com API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch a player profile. Returns null if username does not exist. */
export async function getPlayer(username: string): Promise<ChessPlayer | null> {
  try {
    return await chessFetch<ChessPlayer>(`/player/${encodeURIComponent(username.toLowerCase())}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

/** Fetch a player's rating stats across all time controls. */
export async function getPlayerStats(username: string): Promise<ChessPlayerStats> {
  return chessFetch<ChessPlayerStats>(`/player/${encodeURIComponent(username.toLowerCase())}/stats`);
}

/** Fetch the list of monthly game archive URLs for a player. */
export async function getGameArchives(username: string): Promise<string[]> {
  const data = await chessFetch<ChessArchivesResponse>(
    `/player/${encodeURIComponent(username.toLowerCase())}/games/archives`
  );
  return data.archives;
}

/** Fetch all games for a specific month. */
export async function getMonthlyGames(
  username: string,
  year: number,
  month: number
): Promise<ChessGameRaw[]> {
  const mm = String(month).padStart(2, "0");
  const data = await chessFetch<ChessMonthlyGamesResponse>(
    `/player/${encodeURIComponent(username.toLowerCase())}/games/${year}/${mm}`
  );
  return data.games;
}

// ============================================================
// PGN header extraction helpers
// ============================================================

function extractPgnHeader(pgn: string, header: string): string | null {
  const regex = new RegExp(`\\[${header}\\s+"([^"]*)"\\]`);
  const match = pgn.match(regex);
  return match?.[1] ?? null;
}

function countMoves(pgn: string): number | null {
  // Find move numbers in the movetext (after the headers)
  const movetext = pgn.replace(/\[[^\]]*\]\s*/g, "").trim();
  if (!movetext) return null;
  const moveNumbers = movetext.match(/\d+\./g);
  if (!moveNumbers) return null;
  // The last move number is the total number of moves
  const last = moveNumbers[moveNumbers.length - 1];
  return parseInt(last.replace(".", ""), 10) || null;
}

/** Map Chess.com result strings to our simplified result. */
function normalizeResult(playerResult: string): "win" | "loss" | "draw" {
  if (playerResult === "win") return "win";
  const drawResults = [
    "agreed",
    "stalemate",
    "repetition",
    "50move",
    "insufficient",
    "timevsinsufficient",
  ];
  if (drawResults.includes(playerResult)) return "draw";
  return "loss";
}

/** Map Chess.com result strings to a human-readable detail. */
function resultDetail(playerResult: string): string | null {
  const map: Record<string, string> = {
    win: "win",
    checkmated: "checkmate",
    resigned: "resignation",
    timeout: "timeout",
    stalemate: "stalemate",
    agreed: "draw by agreement",
    repetition: "draw by repetition",
    "50move": "50-move rule",
    insufficient: "insufficient material",
    timevsinsufficient: "timeout vs insufficient",
    abandoned: "abandoned",
  };
  return map[playerResult] ?? playerResult;
}

// ============================================================
// Parse a raw Chess.com game into our database row format
// ============================================================

export function parseGame(game: ChessGameRaw, username: string): ParsedChessGame {
  const lowerUsername = username.toLowerCase();
  const isWhite = game.white.username.toLowerCase() === lowerUsername;
  const playerSide = isWhite ? game.white : game.black;
  const opponentSide = isWhite ? game.black : game.white;

  const playedAt = new Date(game.end_time * 1000);

  // Extract accuracy from PGN if available
  let accuracy: number | null = null;
  if (game.pgn) {
    // PGN may contain per-player accuracy in headers like [WhiteAccuracy "87.5"]
    const accHeader = isWhite ? "WhiteAccuracy" : "BlackAccuracy";
    const accStr = extractPgnHeader(game.pgn, accHeader);
    if (accStr) {
      const parsed = parseFloat(accStr);
      if (!isNaN(parsed)) accuracy = parsed;
    }
    // Fallback: some PGNs have a single [Accuracy "X"] header
    if (accuracy === null) {
      const fallback = extractPgnHeader(game.pgn, "Accuracy");
      if (fallback) {
        const parsed = parseFloat(fallback);
        if (!isNaN(parsed)) accuracy = parsed;
      }
    }
  }

  // Extract opening name from PGN
  const openingName = game.pgn
    ? extractPgnHeader(game.pgn, "ECOUrl")?.split("/").pop()?.replace(/-/g, " ") ??
      extractPgnHeader(game.pgn, "Opening") ??
      null
    : null;

  // Count moves
  const numMoves = game.pgn ? countMoves(game.pgn) : null;

  // Estimate duration from time_control (base time in seconds)
  let durationSeconds: number | null = null;
  const tcParts = game.time_control.split("+");
  const baseTime = parseInt(tcParts[0], 10);
  if (!isNaN(baseTime)) {
    // Rough estimate: 2x base time for a full game (both sides)
    durationSeconds = baseTime * 2;
  }

  return {
    game_id: game.url,
    played_at: playedAt.toISOString(),
    date: playedAt.toISOString().split("T")[0],
    time_class: game.time_class,
    time_control: game.time_control,
    player_color: isWhite ? "white" : "black",
    player_rating: playerSide.rating,
    opponent_rating: opponentSide.rating,
    result: normalizeResult(playerSide.result),
    result_detail: resultDetail(playerSide.result),
    accuracy,
    num_moves: numMoves,
    duration_seconds: durationSeconds,
    opening_name: openingName,
    raw_pgn: game.pgn ?? null,
    source: "chess.com",
  };
}
