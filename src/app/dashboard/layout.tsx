import "./dashboard-shell.css"
import SidebarNav from "./sidebar-nav"
import PageTransition from "./page-transition"
import DeviceGuard from "./device-guard"
import OnboardingGate from "./onboarding-gate"

// Layout is synchronous — SidebarNav fetches user data client-side.
// This ensures the sidebar renders on FIRST PAINT, not after Supabase auth resolves.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mf-dashboard-shell" style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>

      {/* ── Persistent left sidebar — always visible, never waits for auth ── */}
      <SidebarNav />

      {/* ── Page content — offset by the sidebar's enforced 240px width ── */}
      <a className="mf-skip-link" href="#dashboard-content">Skip to content</a>
      <main id="dashboard-content" className="mf-dashboard-main" style={{
        marginLeft: 240,
        minHeight: "100vh",
        padding: "40px 44px 80px",
      }}>
        <OnboardingGate><DeviceGuard><PageTransition>{children}</PageTransition></DeviceGuard></OnboardingGate>
      </main>


    </div>
  )
}
