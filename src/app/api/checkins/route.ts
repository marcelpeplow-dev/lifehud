import { NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CheckInSchema = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  stress: z.number().int().min(1).max(10),
  notes: z.string().max(500).nullable().optional(),
});

/** GET /api/checkins — returns today's check-in or null */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    return NextResponse.json({ checkin: data ?? null });
  } catch {
    return NextResponse.json({ checkin: null });
  }
}

/** POST /api/checkins — create or update today's check-in */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = CheckInSchema.parse(body);

    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("daily_checkins")
      .upsert(
        { user_id: user.id, date: today, ...parsed, notes: parsed.notes ?? null },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ checkin: data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
