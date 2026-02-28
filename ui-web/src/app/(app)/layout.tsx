import { NavBar } from "@/components/layout/nav-bar";
import { StatusBar } from "@/components/layout/status-bar";
import { LiveSessionProvider } from "@/lib/live-session-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiveSessionProvider>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 pb-10">{children}</main>
        <StatusBar />
      </div>
    </LiveSessionProvider>
  );
}
