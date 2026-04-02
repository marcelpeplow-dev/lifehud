import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWhoopAuthUrl } from "@/lib/whoop/client";
import { randomBytes } from "crypto";

export async function POST() {
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET) {
    return NextResponse.json({ error: "Whoop integration not configured" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Encode user ID in state for callback verification
    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64url");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectUri = `${appUrl}/api/whoop/callback`;

    const url = buildWhoopAuthUrl(redirectUri, state);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
