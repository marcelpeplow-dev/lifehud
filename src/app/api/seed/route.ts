import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { seedUserData } from "@/lib/utils/seed";

export async function POST(request: Request) {
  // Only available in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  let body: { user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id } = body;
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const counts = await seedUserData(supabase, user_id);
    return NextResponse.json({ success: true, inserted: counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
