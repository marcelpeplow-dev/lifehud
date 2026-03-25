import { createClient } from "@/lib/supabase/server";
import { getPlayerStats } from "@/lib/chess/client";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { DeviceCard } from "@/components/settings/DeviceCard";
import { ConnectDeviceButton } from "@/components/settings/ConnectDeviceButton";
import { ConnectFitbitButton } from "@/components/settings/ConnectFitbitButton";
import { FitbitCard } from "@/components/settings/FitbitCard";
import { ChessCard } from "@/components/settings/ChessCard";
import { ConnectChessButton } from "@/components/settings/ConnectChessButton";
import { LichessCard } from "@/components/settings/LichessCard";
import { ConnectLichessButton } from "@/components/settings/ConnectLichessButton";
import { getUser as getLichessUser } from "@/lib/lichess/client";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { ManualTrackingSection } from "@/components/settings/ManualTrackingSection";
import type { Profile, DeviceConnection } from "@/types/index";
import { redirect } from "next/navigation";

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

interface FitbitIntegration {
  id: string;
  provider_user_id: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; fitbit_error?: string }>;
}) {
  const { connected, fitbit_error: fitbitError } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileData }, { data: devicesData }, { data: fitbitData }, { data: manualConfigData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("device_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false }),
    supabase
      .from("user_integrations")
      .select("id, provider_user_id, last_sync_at, created_at")
      .eq("user_id", user.id)
      .eq("provider", "fitbit")
      .maybeSingle(),
    supabase.from("user_manual_config").select("*").eq("user_id", user.id).order("display_order"),
  ]);

  const profile = profileData as Profile | null;
  const devices = (devicesData ?? []) as DeviceConnection[];
  const fitbitIntegration = fitbitData as FitbitIntegration | null;

  // Fetch Chess.com ratings if connected
  let chessStats: { rapid: number | null; blitz: number | null; bullet: number | null } | null = null;
  if (profile?.chess_username) {
    try {
      const stats = await getPlayerStats(profile.chess_username);
      chessStats = {
        rapid: stats.chess_rapid?.last?.rating ?? null,
        blitz: stats.chess_blitz?.last?.rating ?? null,
        bullet: stats.chess_bullet?.last?.rating ?? null,
      };
    } catch {
      // If Chess.com API fails, show card without ratings
      chessStats = { rapid: null, blitz: null, bullet: null };
    }
  }

  // Fetch Lichess ratings if connected
  let lichessStats: { rapid: number | null; blitz: number | null; bullet: number | null } | null = null;
  if (profile?.lichess_username) {
    try {
      const lichessUser = await getLichessUser(profile.lichess_username);
      if (lichessUser) {
        lichessStats = {
          rapid: lichessUser.perfs.rapid?.rating ?? null,
          blitz: lichessUser.perfs.blitz?.rating ?? null,
          bullet: lichessUser.perfs.bullet?.rating ?? null,
        };
      } else {
        lichessStats = { rapid: null, blitz: null, bullet: null };
      }
    } catch {
      lichessStats = { rapid: null, blitz: null, bullet: null };
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Manage your profile, devices, and account</p>
      </div>

      {/* Device connected banner */}
      {connected === "1" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          Device connected successfully. Data will sync automatically.
        </div>
      )}

      {/* Fitbit connected banner */}
      {connected === "fitbit" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          Fitbit connected! Your data is syncing now.
        </div>
      )}

      {/* Fitbit error banner */}
      {fitbitError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          Fitbit connection failed: {fitbitError}
        </div>
      )}

      {/* Profile */}
      <Section
        title="Profile"
        description="Your personal details used for personalized coaching."
      >
        <ProfileForm
          userId={user.id}
          initial={{
            display_name: profile?.display_name ?? null,
            date_of_birth: profile?.date_of_birth ?? null,
            height_cm: profile?.height_cm ?? null,
            weight_kg: profile?.weight_kg ?? null,
            timezone: profile?.timezone ?? "UTC",
          }}
        />
      </Section>

      {/* Fitbit Integration */}
      <Section
        title="Fitbit"
        description="Connect your Fitbit account to sync sleep, activity, and heart rate data."
      >
        {fitbitIntegration ? (
          <FitbitCard integration={fitbitIntegration} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Link your Fitbit to automatically import sleep, workouts, steps, heart rate, and HRV data.
            </p>
            <ConnectFitbitButton />
          </div>
        )}
      </Section>

      {/* Chess.com */}
      <Section
        title="Chess.com"
        description="Connect your Chess.com account to track ratings and discover cross-domain patterns."
      >
        {profile?.chess_username && chessStats ? (
          <ChessCard
            connection={{
              username: profile.chess_username,
              avatar: null,
              lastSync: profile.last_chess_sync ?? null,
              ...chessStats,
            }}
          />
        ) : (
          <ConnectChessButton />
        )}
      </Section>

      {/* Lichess */}
      <Section
        title="Lichess"
        description="Connect your Lichess account to track ratings and discover cross-domain patterns."
      >
        {profile?.lichess_username && lichessStats ? (
          <LichessCard
            connection={{
              username: profile.lichess_username,
              lastSync: profile.last_lichess_sync ?? null,
              ...lichessStats,
            }}
          />
        ) : (
          <ConnectLichessButton />
        )}
      </Section>

      {/* Other Devices (Terra) */}
      <Section
        title="Other devices"
        description="Connect other wearables via Terra."
      >
        <div className="space-y-3">
          {devices.length > 0 ? (
            devices.map((device) => <DeviceCard key={device.id} device={device} />)
          ) : (
            <p className="text-sm text-zinc-500 pb-1">No other devices connected.</p>
          )}
          <div className="pt-1">
            <ConnectDeviceButton />
          </div>
        </div>
      </Section>

      {/* Manual Tracking */}
      <Section
        title="Manual Tracking"
        description="Choose which domains you want to log manually each day."
      >
        <ManualTrackingSection initialConfigs={manualConfigData ?? []} />
      </Section>

      {/* Account */}
      <Section title="Account">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">{user.email}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Signed in with email</p>
          </div>
          <SignOutButton />
        </div>
      </Section>
    </div>
  );
}
