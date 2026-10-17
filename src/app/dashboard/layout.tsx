import { authenticatedUser } from "@/lib/authBoundary"
import { isResumeOnlyAccount } from "@/lib/resumeOnlyEntitlement"
import "./dashboard-shell.css"
import SidebarNav from "./sidebar-nav"
import PageTransition from "./page-transition"
import DeviceGuard from "./device-guard"
import PhoneReminder from "./phone-reminder"
import OnboardingGate from "./onboarding-gate"
import PlanVisionLink from "./_components/plan-vision-link"
import FloatingAgent from "./_components/floating-agent"

// Layout is synchronous — SidebarNav fetches user data client-side.
// This ensures the sidebar renders on FIRST PAINT, not after Supabase auth resolves.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await authenticatedUser()
  const resumeOnly = await isResumeOnlyAccount(user)
  return (
    <div className="mf-dashboard-shell" style={{ minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--text)" }}>

      {/* ── Persistent left sidebar — always visible, never waits for auth ── */}
      <SidebarNav resumeOnly={resumeOnly} />

      {/* ── Page content — offset by the sidebar's enforced 240px width ── */}
      <a className="mf-skip-link" href="#dashboard-content">Skip to content</a>
      <main id="dashboard-content" className="mf-dashboard-main" style={{
        marginLeft: 240,
        minHeight: "100vh",
        padding: "40px 44px 80px",
      }}>
        <PhoneReminder />
        {!resumeOnly && <PlanVisionLink />}
        {resumeOnly ? <DeviceGuard><PageTransition>{children}</PageTransition></DeviceGuard> : <OnboardingGate><DeviceGuard><PageTransition>{children}</PageTransition></DeviceGuard></OnboardingGate>}
      </main>

      {/* ── Floating MFit Agent — the strategist, on every page ── */}
      {!resumeOnly && <FloatingAgent />}


    </div>
  )
}
