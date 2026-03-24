import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Revoke token at Fitbit (best-effort)
    const serviceClient = createServiceClient();
    const { data: integration } = await serviceClient
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "fitbit")
      .single();

    if (integration?.access_token) {
      const clientId = process.env.FITBIT_CLIENT_ID;
      const clientSecret = process.env.FITBIT_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        await fetch("https://api.fitbit.com/oauth2/revoke", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
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
      .eq("provider", "fitbit");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
