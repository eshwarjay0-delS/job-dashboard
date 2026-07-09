import CopilotWidget from "@/components/CopilotWidget"
import SidebarNav from "./sidebar-nav"
import PageTransition from "./page-transition"

// Layout is synchronous — SidebarNav fetches user data client-side.
// This ensures the sidebar renders on FIRST PAINT, not after Supabase auth resolves.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg, #ffffff)", color: "var(--text, #1a2035)" }}>

      {/* ── Persistent left sidebar — always visible, never waits for auth ── */}
      <SidebarNav />

      {/* ── Page content — offset by sidebar width ── */}
      <main style={{
        marginLeft: 220,
        minHeight: "100vh",
        padding: "28px 32px 72px",
      }}>
        <PageTransition>{children}</PageTransition>
      </main>

      {/* ── Floating AI Copilot ── */}
      <CopilotWidget />
    </div>
  )
}
