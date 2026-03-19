import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { seedUserData } from "@/lib/utils/seed";

async function seed(userId?: string) {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ENABLED !== "true") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  // If no user_id provided, get it from the current session
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated — sign in first or pass user_id" }, { status: 401 });
    }
    resolvedUserId = user.id;
  }

  const serviceClient = createServiceClient();
  const counts = await seedUserData(serviceClient, resolvedUserId);
  return NextResponse.json({ success: true, user_id: resolvedUserId, inserted: counts });
}

/** GET /api/seed — seeds the currently signed-in user */
export async function GET() {
  try {
    return await seed();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/seed — seeds a specific user_id from the request body */
export async function POST(request: Request) {
  try {
    let userId: string | undefined;
    try {
      const body = await request.json();
      userId = body.user_id;
    } catch {
      // no body — fall back to session
    }
    return await seed(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
