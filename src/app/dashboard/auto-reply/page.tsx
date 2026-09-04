// Auto Reply — read-only triage board for the recruiter-selection algorithm.
//
// A background loop scans Gmail for threads where you have ALREADY hand-written
// a reply draft to a recruiter at one of the bench-sales middlemen (tekblu,
// cloudquestit). For each it pulls the job description out of the thread and
// works out which recruiter address the reply SHOULD be addressed to.
//
// In this milestone the loop has NO write access to Gmail and cannot send
// anything. This page exists purely so the selection algorithm can be graded by
// a human before it is ever allowed to act — the candidate table on each job is
// the actual product here, not the job list.
//
// Server shell only (static chrome); everything live lives in AutoReplyClient,
// which fetches /api/auto-reply/jobs on mount.

import AutoReplyClient from "./AutoReplyClient"

export const dynamic = "force-dynamic"

export default function AutoReplyPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent), var(--accent-h))",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
        }}>📬</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Auto Reply</h1>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 0" }}>
            Grade the recruiter-selection algorithm. Every drafted reply the loop finds is shown with the
            addresses it considered and the one it would have used.
          </p>
        </div>
      </div>

      <AutoReplyClient />
    </div>
  )
}
