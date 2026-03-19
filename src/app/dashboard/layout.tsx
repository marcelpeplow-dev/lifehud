import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CheckInFAB } from "@/components/checkin/CheckInFAB";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      <MobileNav />
      <CheckInFAB />
    </div>
  );
}
