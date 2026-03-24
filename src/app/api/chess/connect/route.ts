import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlayer, getPlayerStats } from "@/lib/chess/client";

/** POST /api/chess/connect — Verify a Chess.com username and save to profile */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const username = (body.username ?? "").trim();
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    // Verify the username exists on Chess.com
    const player = await getPlayer(username);
    if (!player) {
      return NextResponse.json({ error: "Username not found on Chess.com" }, { status: 404 });
    }

    // Fetch current stats
    const stats = await getPlayerStats(username);

    // Save to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ chess_username: player.username })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      player: {
        username: player.username,
        avatar: player.avatar ?? null,
        url: player.url,
      },
      stats: {
        rapid: stats.chess_rapid?.last?.rating ?? null,
        blitz: stats.chess_blitz?.last?.rating ?? null,
        bullet: stats.chess_bullet?.last?.rating ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/chess/connect — Disconnect Chess.com account */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("profiles")
      .update({ chess_username: null, last_chess_sync: null })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Disconnect failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
