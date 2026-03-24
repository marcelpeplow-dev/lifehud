import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRecentGames, parseGame } from "@/lib/lichess/client";
import type { ParsedLichessGame } from "@/lib/lichess/client";

/** POST /api/lichess/sync — Sync Lichess games for the authenticated user */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get lichess username from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("lichess_username, last_lichess_sync")
      .eq("id", user.id)
      .single();

    const lichessUsername = profile?.lichess_username;
    if (!lichessUsername) {
      return NextResponse.json(
        { error: "No Lichess username connected" },
        { status: 400 },
      );
    }

    // Calculate since timestamp: use last sync time or 90 days ago
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const since = profile?.last_lichess_sync
      ? Math.max(new Date(profile.last_lichess_sync).getTime(), cutoff.getTime())
      : cutoff.getTime();

    // Fetch games from Lichess API
    const rawGames = await getRecentGames(lichessUsername, {
      max: 200,
      since,
    });

    // Parse games, filtering out non-standard variants
    const allParsedGames: ParsedLichessGame[] = [];
    for (const game of rawGames) {
      const parsed = parseGame(game, lichessUsername);
      if (parsed && new Date(parsed.played_at) >= cutoff) {
        allParsedGames.push(parsed);
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
        console.error("Lichess sync upsert error:", error);
        continue;
      }

      if (data) {
        newGames += data.length;
        for (const row of data) {
          timeClassCounts[row.time_class] = (timeClassCounts[row.time_class] || 0) + 1;
        }
      }
    }

    // Update last_lichess_sync timestamp
    await serviceClient
      .from("profiles")
      .update({ last_lichess_sync: new Date().toISOString() })
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
    console.error("Lichess sync error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
