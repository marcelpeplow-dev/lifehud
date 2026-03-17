import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWidgetSession } from "@/lib/terra/client";

/** POST /api/terra/auth
 *  Returns a Terra widget URL the frontend opens to connect a wearable. */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const widgetUrl = await generateWidgetSession(user.id);
    return NextResponse.json({ url: widgetUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
