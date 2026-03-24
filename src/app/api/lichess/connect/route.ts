import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/lichess/client";

/** POST /api/lichess/connect — Verify a Lichess username and save to profile */
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

    // Verify the username exists on Lichess
    const lichessUser = await getUser(username);
    if (!lichessUser) {
      return NextResponse.json({ error: "Username not found on Lichess" }, { status: 404 });
    }

    // Save to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ lichess_username: lichessUser.username })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const perfs = lichessUser.perfs;

    return NextResponse.json({
      success: true,
      player: {
        username: lichessUser.username,
        url: lichessUser.url,
      },
      stats: {
        rapid: perfs.rapid?.rating ?? null,
        blitz: perfs.blitz?.rating ?? null,
        bullet: perfs.bullet?.rating ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/lichess/connect — Disconnect Lichess account */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("profiles")
      .update({ lichess_username: null, last_lichess_sync: null })
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
