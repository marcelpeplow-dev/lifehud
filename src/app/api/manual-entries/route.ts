import { NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const EntrySchema = z.object({
  entries: z.array(
    z.object({
      metric_id: z.string(),
      date: z.string(),
      value: z.number(),
    }),
  ),
});

/** GET /api/manual-entries?date=YYYY-MM-DD — returns entries for the given date */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date =
      !dateParam || dateParam === "today"
        ? format(new Date(), "yyyy-MM-dd")
        : dateParam;

    const { data, error } = await supabase
      .from("manual_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data ?? [], date });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/manual-entries — upsert entries for a given date */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { entries } = EntrySchema.parse(body);

    if (entries.length === 0) return NextResponse.json({ entries: [] });

    const rows = entries.map((e) => ({
      user_id: user.id,
      metric_id: e.metric_id,
      date: e.date,
      value: e.value,
    }));

    const { data, error } = await supabase
      .from("manual_entries")
      .upsert(rows, { onConflict: "user_id,date,metric_id" })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
