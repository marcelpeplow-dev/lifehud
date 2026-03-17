import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { DeviceCard } from "@/components/settings/DeviceCard";
import { ConnectDeviceButton } from "@/components/settings/ConnectDeviceButton";
import { SignOutButton } from "@/components/settings/SignOutButton";
import type { Profile, DeviceConnection } from "@/types/index";

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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profileData }, { data: devicesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("device_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false }),
  ]);

  const profile = profileData as Profile | null;
  const devices = (devicesData ?? []) as DeviceConnection[];

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

      {/* Devices */}
      <Section
        title="Connected devices"
        description="Wearables syncing data to Life HUD automatically."
      >
        <div className="space-y-3">
          {devices.length > 0 ? (
            devices.map((device) => <DeviceCard key={device.id} device={device} />)
          ) : (
            <p className="text-sm text-zinc-500 pb-1">No devices connected yet.</p>
          )}
          <div className="pt-1">
            <ConnectDeviceButton />
          </div>
        </div>
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
