import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/fitbit/client";
import { randomBytes } from "crypto";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // State encodes user ID for the callback to verify
    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64url");

    const url = buildAuthUrl(state);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
