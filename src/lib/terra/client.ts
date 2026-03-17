import { createHmac, timingSafeEqual } from "crypto";

const TERRA_BASE = "https://api.tryterra.co/v2";

function terraHeaders() {
  return {
    "Content-Type": "application/json",
    "dev-id": process.env.TERRA_DEV_ID ?? "",
    "x-api-key": process.env.TERRA_API_KEY ?? "",
  };
}

/** Generate a Terra widget session URL for connecting a wearable device.
 *  referenceId should be our Supabase user.id so we can link on auth webhook. */
export async function generateWidgetSession(referenceId: string): Promise<string> {
  const res = await fetch(`${TERRA_BASE}/auth/generateWidgetSession`, {
    method: "POST",
    headers: terraHeaders(),
    body: JSON.stringify({
      reference_id: referenceId,
      providers: "FITBIT,APPLE,GARMIN,OURA,WHOOP",
      auth_success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?connected=1`,
      language: "en",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Terra API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.status !== "success" || !data.url) {
    throw new Error(`Unexpected Terra response: ${JSON.stringify(data)}`);
  }
  return data.url as string;
}

/** Verify the terra-signature header against the raw request body.
 *  Returns true if valid, false otherwise. */
export function verifyTerraSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.TERRA_WEBHOOK_SECRET;
  if (!secret) return false;

  // Format: "t=<timestamp>,v1=<hash>"
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const { t: timestamp, v1: signature } = parts;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
