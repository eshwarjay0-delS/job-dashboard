import CopilotWidget from "@/components/CopilotWidget"
import SidebarNav from "./sidebar-nav"
import PageTransition from "./page-transition"
import CommentBox from "./CommentBox"

// Layout is synchronous — SidebarNav fetches user data client-side.
// This ensures the sidebar renders on FIRST PAINT, not after Supabase auth resolves.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>

      {/* ── Persistent left sidebar — always visible, never waits for auth ── */}
      <SidebarNav />

      {/* ── Page content — offset by the sidebar's enforced 240px width ── */}
      <main style={{
        marginLeft: 240,
        minHeight: "100vh",
        padding: "40px 44px 80px",
      }}>
        <PageTransition>{children}</PageTransition>
        <CommentBox />
      </main>

      {/* ── Floating AI Copilot ── */}
      <CopilotWidget />
    </div>
  )
}
