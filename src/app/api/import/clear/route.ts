import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CLEARABLE_SOURCES = ["garmin_csv", "seed"];

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await Promise.all([
      supabase
        .from("sleep_records")
        .delete()
        .eq("user_id", user.id)
        .in("source", CLEARABLE_SOURCES),
      supabase
        .from("workouts")
        .delete()
        .eq("user_id", user.id)
        .in("source", CLEARABLE_SOURCES),
      supabase
        .from("daily_metrics")
        .delete()
        .eq("user_id", user.id)
        .in("source", CLEARABLE_SOURCES),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
