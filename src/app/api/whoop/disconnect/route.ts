import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Revoke token at Whoop (best-effort)
    const { data: integration } = await serviceClient
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "whoop")
      .single();

    if (integration?.access_token) {
      const clientId = process.env.WHOOP_CLIENT_ID;
      const clientSecret = process.env.WHOOP_CLIENT_SECRET;
      if (clientId && clientSecret) {
        await fetch("https://api.prod.whoop.com/oauth/oauth2/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: integration.access_token }),
        }).catch(() => {
          // Best-effort revocation
        });
      }
    }

    // Delete integration record
    await serviceClient
      .from("user_integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "whoop");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
