"use client"

import type { ResumeGapReport } from "@/lib/resume-gap-report"

function Terms({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-xs" style={{ color: "var(--text-soft)" }}>{empty}</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span key={item} className="rounded-full border px-2.5 py-1 text-[11px]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {item}
        </span>
      ))}
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed" style={{ color: "var(--text-soft)" }}>{note}</p>
    </div>
  )
}

const BLOCKER_LABELS: Record<string, string> = {
  skills_only: "The AI writers did not complete the full rewrite",
  floor_only: "A keyword-placement fallback was used",
  draft_parts_missing: "One or more draft sections are incomplete",
  unverified_jd_terms: "Unsupported job-post terms appeared as new claims",
  ats_check_failed: "The exported DOCX parseability check failed",
  role_evidence_gaps: "At least one role is below its experience-evidence target",
  unchanged: "The generated document did not change",
}

export default function ResumeGapReportPanel({ report }: { report: ResumeGapReport }) {
  if (!report.hasEvidence) return null

  const coverage = report.coverage === null ? "Not measured" : `${report.coverage.toFixed(1)}%`
  const supported = report.supportedCoverage === null ? "Not measured" : `${report.supportedCoverage.toFixed(1)}%`
  const blockers = report.qualityBlockers.map(code => BLOCKER_LABELS[code] || "").filter(Boolean)

  return (
    <section aria-labelledby="resume-gap-report-title" className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 id="resume-gap-report-title" className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Resume-to-JD gap report
        </h2>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-soft)" }}>
          Based on the exported Word document and the original resume plus explicit experience confirmations.
          Keyword overlap is not an ATS vendor score or proof of qualification.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Metric
            label="JD keyword overlap"
            value={coverage}
            note="Share of measured JD terms present in the exported DOCX."
          />
          <Metric
            label="Evidence-supported coverage"
            value={supported}
            note="Requirements supported by the source resume or explicit first-person confirmation."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              Missing keywords in exported DOCX ({report.missingKeywords.length})
            </h3>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
              These terms are absent from the generated Word file. They are document gaps, not a judgement about your experience.
            </p>
            <Terms items={report.missingKeywords} empty="No missing keywords were recorded by the exported-file recount." />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              Requirements without candidate evidence ({report.unsupportedRequirements.length})
            </h3>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
              These requirements were not supported by the original resume or explicit experience confirmations.
              Keep them out of work claims and credentials unless they are genuinely confirmed.
            </p>
            <Terms items={report.unsupportedRequirements} empty="No unsupported requirements were recorded." />
          </div>
        </div>

        {report.unverifiedClaims.length > 0 && (
          <div role="alert" className="rounded-xl border p-3 space-y-2"
            style={{ borderColor: "#b77b72", background: "var(--surface-2)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              Unsupported terms detected as new claims in the generated DOCX
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
              Do not use this version until those claims are removed or supported by genuine candidate evidence.
            </p>
            <Terms items={report.unverifiedClaims} empty="" />
          </div>
        )}

        {report.roles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold" style={{ color: "var(--text)" }}>Experience evidence by role</h3>
            <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
              Counts show how many role-specific JD terms appear in each role's bullets; they do not verify employment independently.
            </p>
            <div className="space-y-2">
              {report.roles.map(role => {
                const ratio = role.required > 0
                  ? `${Math.floor((role.skills / role.required) * 1000) / 10}%`
                  : "No role target"
                return (
                  <div key={role.role} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold min-w-0 break-words" style={{ color: "var(--text)" }}>{role.role}</p>
                      <p className="text-xs font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {role.skills}/{role.required} · {ratio}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px]" style={{ color: "var(--text-soft)" }}>
                      {role.bullets} bullets · {role.rewritten} rewritten · {role.added} added
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {report.enrichment && report.enrichment.suggested.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold" style={{ color: "var(--text)" }}>Gemini keyword suggestions</h3>
            <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
              Suggestions are advisory. A suggestion does not become candidate experience unless supported by the source or an explicit confirmation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Present in exported DOCX</p>
                <Terms items={report.enrichment.placed} empty="None placed." />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Not present / blocked</p>
                <Terms items={report.enrichment.blocked} empty="None blocked." />
              </div>
            </div>
          </div>
        )}

        {report.atsPassed !== null && (
          <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
            Exported DOCX parseability: <span className="font-semibold" style={{ color: "var(--text)" }}>
              {report.atsPassed ? "passed" : "needs review"}
            </span>
            {report.atsIssues.length > 0 ? ` · ${report.atsIssues.length} issue(s)` : ""}
          </p>
        )}

        {blockers.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold" style={{ color: "var(--text)" }}>Review flags</p>
            {blockers.map(label => <p key={label} className="text-[11px]" style={{ color: "var(--text-soft)" }}>• {label}</p>)}
          </div>
        )}
      </div>
    </section>
  )
}
