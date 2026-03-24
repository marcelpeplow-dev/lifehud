import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getGameArchives, getMonthlyGames, parseGame } from "@/lib/chess/client";
import type { ParsedChessGame } from "@/lib/chess/client";

/** POST /api/chess/sync — Sync Chess.com games for the authenticated user */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get chess username from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("chess_username")
      .eq("id", user.id)
      .single();

    const chessUsername = profile?.chess_username;
    if (!chessUsername) {
      return NextResponse.json(
        { error: "No Chess.com username connected" },
        { status: 400 }
      );
    }

    // Fetch archive list
    const archives = await getGameArchives(chessUsername);

    // Filter to last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffYear = cutoff.getFullYear();
    const cutoffMonth = cutoff.getMonth() + 1; // 1-indexed

    const recentArchives = archives.filter((url) => {
      // Archive URLs look like: https://api.chess.com/pub/player/username/games/2026/03
      const parts = url.split("/");
      const year = parseInt(parts[parts.length - 2], 10);
      const month = parseInt(parts[parts.length - 1], 10);
      if (year > cutoffYear) return true;
      if (year === cutoffYear && month >= cutoffMonth) return true;
      return false;
    });

    // Fetch games from each month (serially per Chess.com rate limit guidelines)
    const allParsedGames: ParsedChessGame[] = [];

    for (const archiveUrl of recentArchives) {
      const parts = archiveUrl.split("/");
      const year = parseInt(parts[parts.length - 2], 10);
      const month = parseInt(parts[parts.length - 1], 10);

      const games = await getMonthlyGames(chessUsername, year, month);

      for (const game of games) {
        // Only chess games (skip variants)
        if (game.rules !== "chess") continue;

        const parsed = parseGame(game, chessUsername);

        // Only include games within the 90-day window
        if (new Date(parsed.played_at) >= cutoff) {
          allParsedGames.push(parsed);
        }
      }
    }

    // Upsert games using service client (bypasses RLS for insert)
    const serviceClient = createServiceClient();
    let newGames = 0;
    const timeClassCounts: Record<string, number> = {};

    // Batch upsert in chunks of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < allParsedGames.length; i += BATCH_SIZE) {
      const batch = allParsedGames.slice(i, i + BATCH_SIZE).map((g) => ({
        user_id: user.id,
        ...g,
      }));

      const { data, error } = await serviceClient
        .from("chess_games")
        .upsert(batch, { onConflict: "user_id,game_id", ignoreDuplicates: true })
        .select("id, time_class");

      if (error) {
        console.error("Chess sync upsert error:", error);
        continue;
      }

      if (data) {
        newGames += data.length;
        for (const row of data) {
          timeClassCounts[row.time_class] = (timeClassCounts[row.time_class] || 0) + 1;
        }
      }
    }

    // Update last_chess_sync timestamp
    await serviceClient
      .from("profiles")
      .update({ last_chess_sync: new Date().toISOString() })
      .eq("id", user.id);

    // Build summary string
    const parts: string[] = [];
    for (const [tc, count] of Object.entries(timeClassCounts)) {
      parts.push(`${count} ${tc}`);
    }
    const summary = parts.length > 0
      ? `Synced ${newGames} new games (${parts.join(", ")})`
      : `No new games to sync (${allParsedGames.length} games already up to date)`;

    return NextResponse.json({
      success: true,
      newGames,
      totalProcessed: allParsedGames.length,
      timeClassCounts,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("Chess sync error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
