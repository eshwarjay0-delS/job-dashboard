"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import JSZip from "jszip"
import { useDialogs } from "@/components/ui/dialog-provider"
import { IllustBuilder } from "@/components/Illustrations"
import {
  countWords, bulletHasMetric, hasHavingOpener, bulletHasWeakOpener,
  summaryIsConcatenated, findDuplicateSkills, isEnvironmentTrailer,
} from "@/lib/resume/rules"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Bullet { id: string; text: string }
interface JobEntry {
  id: string
  employer: string
  title: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: Bullet[]
}
interface CertEntry { id: string; name: string; date: string }
interface SkillGroup { id: string; category: string; skills: string }

type RoleType = "security" | "other"

const ROLE_PRESETS: Record<string, { type: RoleType; skillGroups: SkillGroup[]; certSuggestions: string[] }> = {
  "OT Security Engineer": {
    type: "security",
    skillGroups: [
      { id: "sg1", category: "OT/ICS Platforms", skills: "Dragos, Industrial Defender, Claroty, Nozomi Networks" },
      { id: "sg2", category: "Security Operations", skills: "Splunk, IBM QRadar, Microsoft Sentinel, XSOAR" },
      { id: "sg3", category: "Frameworks & Standards", skills: "NERC CIP, NIST 800-82, ISA/IEC 62443, MITRE ATT&CK for ICS" },
      { id: "sg4", category: "Protocols & Systems", skills: "SCADA, DCS, PLC, Modbus, DNP3, OPC-UA, HMI" },
      { id: "sg5", category: "Cloud & Infrastructure", skills: "AWS, Azure, VMware, Active Directory, CrowdStrike Falcon" },
      { id: "sg6", category: "Scripting & Tools", skills: "Python, PowerShell, Bash, Wireshark, Nessus" },
    ],
    certSuggestions: ["OSCP", "GICSP (ICS/SCADA Security)", "AZ-500", "PenTest+", "CySA+", "CISSP"],
  },
  "AppSec / Senior Security Engineer": {
    type: "security",
    skillGroups: [
      { id: "sg1", category: "AppSec Testing", skills: "Burp Suite Pro, OWASP ZAP, Invicti, Acunetix, Nikto" },
      { id: "sg2", category: "SAST / SCA / DAST", skills: "Fortify, Checkmarx, Snyk, Veracode, SonarQube, DefectDojo" },
      { id: "sg3", category: "Cloud Security", skills: "Wiz, Prisma Cloud, AWS Security Hub, Azure Defender, GCP SCC" },
      { id: "sg4", category: "DLP / PAM / EDR", skills: "CyberArk, BeyondTrust, CrowdStrike, Netskope, Zscaler, Qualys" },
      { id: "sg5", category: "Frameworks", skills: "OWASP Top 10, SANS Top 25, NIST CSF, SOC 2, ISO 27001, MITRE ATT&CK" },
      { id: "sg6", category: "Languages / DevOps", skills: "Python, Java, Go, Terraform, Kubernetes, GitHub Actions, Jenkins" },
    ],
    certSuggestions: ["CISSP", "OSCP", "CCSK", "AWS Security Specialty", "CompTIA Security+", "GWAPT"],
  },
  "ServiceNow Developer / Admin": {
    type: "other",
    skillGroups: [
      { id: "sg1", category: "ServiceNow Modules", skills: "ITSM, ITOM, ITBM, GRC, HR Service Delivery, CSM, SecOps" },
      { id: "sg2", category: "Development", skills: "Flow Designer, Service Catalog, Business Rules, Script Includes, Client Scripts, UI Policies" },
      { id: "sg3", category: "Integrations", skills: "REST API, SOAP, MID Server, IntegrationHub, ServiceNow PDI" },
      { id: "sg4", category: "Languages / Tools", skills: "JavaScript, Glide API, HTML, CSS, ATF (Automated Test Framework)" },
      { id: "sg5", category: "Platform", skills: "ServiceNow versions: Jakarta through Xanadu, Instance administration, Performance Analytics" },
    ],
    certSuggestions: ["Certified System Administrator (CSA)", "Certified Application Developer (CAD)", "ITIL Foundation"],
  },
  "Senior Software Engineer": {
    type: "other",
    skillGroups: [
      { id: "sg1", category: "Languages", skills: "TypeScript, JavaScript, Python, Go, Java" },
      { id: "sg2", category: "Frontend", skills: "React, Next.js, Vue.js, Tailwind CSS, GraphQL" },
      { id: "sg3", category: "Backend / Databases", skills: "Node.js, PostgreSQL, Redis, MongoDB, Kafka, gRPC" },
      { id: "sg4", category: "Cloud / DevOps", skills: "AWS, GCP, Docker, Kubernetes, Terraform, GitHub Actions, Datadog" },
    ],
    certSuggestions: ["AWS Solutions Architect", "Google Cloud Professional", "CKA (Kubernetes)"],
  },
  "DevOps / DevSecOps Engineer": {
    type: "other",
    skillGroups: [
      { id: "sg1", category: "CI/CD", skills: "GitHub Actions, Jenkins, GitLab CI, CircleCI, ArgoCD" },
      { id: "sg2", category: "IaC & Orchestration", skills: "Terraform, Ansible, Helm, Kubernetes, Docker, Pulumi" },
      { id: "sg3", category: "Cloud", skills: "AWS (EKS, ECS, S3, Lambda), Azure DevOps, GCP GKE" },
      { id: "sg4", category: "Observability", skills: "Prometheus, Grafana, Datadog, ELK Stack, OpenTelemetry" },
      { id: "sg5", category: "Security / Scanning", skills: "Snyk, Trivy, Checkov, SonarQube, OWASP Dependency-Check" },
    ],
    certSuggestions: ["CKA", "AWS DevOps Professional", "HashiCorp Terraform Associate", "CompTIA Security+"],
  },
  "GRC Analyst / Security Compliance": {
    type: "security",
    skillGroups: [
      { id: "sg1", category: "Frameworks & Standards", skills: "NIST CSF, SOC 2 Type II, ISO 27001, PCI DSS, HIPAA, FedRAMP, FISMA, GDPR" },
      { id: "sg2", category: "GRC Platforms", skills: "ServiceNow GRC, Archer RSA, OneTrust, Drata, Tugboat Logic, Vanta" },
      { id: "sg3", category: "Risk Management", skills: "Risk Assessment, Vendor Risk Management, BCP/DR, Business Impact Analysis, Third-Party Risk" },
      { id: "sg4", category: "Audit & Compliance", skills: "Internal Audit, Evidence Collection, Control Testing, Gap Analysis, Policy Development" },
      { id: "sg5", category: "Cloud / Tools", skills: "AWS, Azure, Jira, Confluence, PowerBI, Excel (audit tracking)" },
    ],
    certSuggestions: ["CISSP", "CISA", "CRISC", "CompTIA Security+", "CISM", "ISO 27001 Lead Auditor"],
  },
  "Data Engineer / Python Developer": {
    type: "other",
    skillGroups: [
      { id: "sg1", category: "Languages", skills: "Python, SQL, Scala, PySpark, Bash" },
      { id: "sg2", category: "Data Platforms", skills: "Databricks, Snowflake, Apache Spark, Hadoop, dbt, Airflow, Kafka" },
      { id: "sg3", category: "Cloud / Storage", skills: "AWS (S3, Glue, Redshift, Lambda), Azure Data Factory, GCP BigQuery" },
      { id: "sg4", category: "ML / Analytics", skills: "pandas, NumPy, scikit-learn, MLflow, Jupyter, Power BI, Tableau" },
      { id: "sg5", category: "Engineering Practices", skills: "Docker, Kubernetes, Terraform, GitHub Actions, Great Expectations, Delta Lake" },
    ],
    certSuggestions: ["AWS Data Engineer Associate", "Databricks Certified Associate", "Google Professional Data Engineer", "dbt Analytics Engineering"],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }
// countWords / bulletHasMetric / hasHavingOpener / bulletHasWeakOpener /
// summaryIsConcatenated / findDuplicateSkills / isEnvironmentTrailer now come from
// @/lib/resume/rules — one shared source of truth with the tailor + scorecard.

function sectionOrder(type: RoleType) {
  if (type === "security") {
    return ["Header", "Summary", "Certifications", "Technical Skills", "Experience", "Projects", "Education"]
  }
  return ["Header", "Summary", "Technical Skills", "Experience", "Projects", "Education", "Certifications"]
}

// Rough page estimate: ~55 lines/page, avg ~10 words/line
function estimatePages(data: BuilderState): number {
  let lines = 6 // header block
  lines += countWords(data.summary) / 12 + 1
  lines += 3 // skills header + groups
  data.skillGroups.forEach(g => { lines += Math.ceil(g.skills.split(",").length / 4) + 1 })
  data.jobs.forEach(j => {
    lines += 3 // employer/title/dates
    j.bullets.forEach(b => { lines += Math.ceil(countWords(b.text) / 12) })
  })
  lines += data.certs.length + 2
  lines += 4 // education
  return Math.round((lines / 55) * 10) / 10
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface BuilderState {
  // Header
  name: string
  targetRole: string
  visaCategory: string
  email: string
  phone: string
  linkedin: string
  location: string
  // Summary
  summary: string
  // Jobs
  jobs: JobEntry[]
  // Skills
  skillGroups: SkillGroup[]
  // Certs
  certs: CertEntry[]
  // Education
  eduDegree: string
  eduSchool: string
  eduDates: string
  eduLocation: string
  // Role type (drives section order)
  roleType: RoleType
}

function blankJob(): JobEntry {
  return {
    id: uid(), employer: "", title: "", location: "", startDate: "", endDate: "", current: false,
    bullets: [{ id: uid(), text: "" }, { id: uid(), text: "" }, { id: uid(), text: "" }, { id: uid(), text: "" }],
  }
}

const DEFAULT_STATE: BuilderState = {
  name: "", targetRole: "", visaCategory: "", email: "", phone: "", linkedin: "", location: "",
  summary: "",
  jobs: [blankJob()],
  skillGroups: [
    { id: uid(), category: "Cloud / Platforms", skills: "" },
    { id: uid(), category: "Languages & Scripting", skills: "" },
    { id: uid(), category: "Security Tools", skills: "" },
    { id: uid(), category: "Frameworks & Standards", skills: "" },
  ],
  certs: [{ id: uid(), name: "", date: "" }],
  eduDegree: "", eduSchool: "", eduDates: "", eduLocation: "",
  roleType: "security",
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-soft)" }}>{label}</h3>
      {children}
    </div>
  )
}

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = "text", mono = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="ring-accent w-full px-3 py-2 text-sm rounded-lg border"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
        color: "var(--text)",
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
        outline: "none",
      }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3, warn }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; warn?: string
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="ring-accent w-full px-3 py-2 text-sm rounded-lg border resize-none"
        style={{
          background: "var(--surface-2)",
          borderColor: warn ? "#f59e0b" : "var(--border)",
          color: "var(--text)",
          outline: "none",
          lineHeight: "1.6",
        }}
      />
      {warn && <p className="text-xs mt-0.5 font-medium" style={{ color: "#d97706" }}>⚠ {warn}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Entry block
// ─────────────────────────────────────────────────────────────────────────────

function JobEntryBlock({
  job, index, onUpdate, onRemove, canRemove, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  job: JobEntry
  index: number
  onUpdate: (j: JobEntry) => void
  onRemove: () => void
  canRemove: boolean
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const set = (k: keyof JobEntry, v: unknown) => onUpdate({ ...job, [k]: v })

  const setBullet = (bulletId: string, text: string) =>
    onUpdate({ ...job, bullets: job.bullets.map(b => b.id === bulletId ? { ...b, text } : b) })

  const addBullet = () => {
    if (job.bullets.length >= 6) return
    onUpdate({ ...job, bullets: [...job.bullets, { id: uid(), text: "" }] })
  }

  const removeBullet = (bulletId: string) => {
    if (job.bullets.length <= 1) return
    onUpdate({ ...job, bullets: job.bullets.filter(b => b.id !== bulletId) })
  }

  const tooManyBullets = job.bullets.length > 6

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
          Job #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          {/* Move up/down */}
          <button
            onClick={onMoveUp} disabled={isFirst}
            className="btn-ghost px-1.5 py-1 text-xs" title="Move up"
            style={{ opacity: isFirst ? 0.25 : 1 }}
          >↑</button>
          <button
            onClick={onMoveDown} disabled={isLast}
            className="btn-ghost px-1.5 py-1 text-xs" title="Move down"
            style={{ opacity: isLast ? 0.25 : 1 }}
          >↓</button>
          {/* Duplicate */}
          <button
            onClick={onDuplicate}
            className="btn-ghost px-2 py-1 text-xs" title="Duplicate this job"
            style={{ color: "var(--accent)" }}
          >⧉ Copy</button>
          {/* Remove */}
          {canRemove && (
            <button onClick={onRemove} className="btn-ghost px-2 py-1 text-xs" style={{ color: "#ef4444" }}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Employer" required>
          <Input value={job.employer} onChange={v => set("employer", v)} placeholder="e.g. Cigna Healthcare" />
        </Field>
        <Field label="Job Title" required>
          <Input value={job.title} onChange={v => set("title", v)} placeholder="e.g. OT Security Analyst" />
        </Field>
        <Field label="Location">
          <Input value={job.location} onChange={v => set("location", v)} placeholder="e.g. St. Louis, MO (Remote)" />
        </Field>
        <div className="flex gap-2">
          <Field label="Start Date">
            <Input value={job.startDate} onChange={v => set("startDate", v)} placeholder="Jul 2023" />
          </Field>
          <Field label="End Date">
            <div className="flex items-center gap-2">
              <Input
                value={job.current ? "Present" : job.endDate}
                onChange={v => set("endDate", v)}
                placeholder="Dec 2024"
              />
            </div>
          </Field>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: "var(--text-muted)" }}>
        <input
          type="checkbox"
          checked={job.current}
          onChange={e => set("current", e.target.checked)}
          className="w-4 h-4 accent-current rounded"
          style={{ accentColor: "var(--accent)" }}
        />
        Current position
      </label>

      {/* Bullets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
            Bullets ({job.bullets.length}/6)
          </p>
          {tooManyBullets && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}>
              ⚠ Cap is 6
            </span>
          )}
        </div>
        <div className="space-y-2">
          {job.bullets.map((b, bi) => {
            const missing = b.text.trim().length > 10 && !bulletHasMetric(b.text)
            return (
              <div key={b.id} className="flex gap-2">
                <span className="text-xs font-bold mt-2.5 w-4 text-center flex-shrink-0" style={{ color: "var(--text-soft)" }}>
                  {bi + 1}
                </span>
                <div className="flex-1">
                  <Textarea
                    value={b.text}
                    onChange={v => setBullet(b.id, v)}
                    rows={2}
                    placeholder="[Action verb] + [tool] + [scope/scale] + [metric] — e.g. Deployed Dragos across 12 ICS sites, cutting MTTD from 72h to 8h"
                    warn={missing ? "No metric detected — add a number, %, or time delta" : undefined}
                  />
                </div>
                <button
                  onClick={() => removeBullet(b.id)}
                  disabled={job.bullets.length <= 1}
                  className="btn-ghost p-1.5 mt-0.5 flex-shrink-0 text-xs"
                  style={{ color: "var(--text-soft)", opacity: job.bullets.length <= 1 ? 0.3 : 1 }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
        {job.bullets.length < 6 && (
          <button onClick={addBullet} className="btn-ghost mt-2 px-3 py-1.5 text-xs w-full" style={{ borderStyle: "dashed", borderWidth: 1, borderColor: "var(--border)" }}>
            + Add bullet {job.bullets.length < 4 ? `(${4 - job.bullets.length} more recommended)` : ""}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation summary
// ─────────────────────────────────────────────────────────────────────────────

interface Warning { icon: string; text: string }

function validateBuilder(state: BuilderState): Warning[] {
  const warns: Warning[] = []

  if (!state.name.trim()) warns.push({ icon: "👤", text: "Candidate name is required" })
  if (!state.email.trim()) warns.push({ icon: "✉️", text: "Email is required" })

  const summaryWords = countWords(state.summary)
  if (summaryWords > 80) warns.push({ icon: "📝", text: `Summary is ${summaryWords} words — cap is 80` })
  if (hasHavingOpener(state.summary)) warns.push({ icon: "🚫", text: '"Having X years" opener detected — rewrite the summary opening' })
  if (summaryIsConcatenated(state.summary)) warns.push({ icon: "🧩", text: "Summary looks concatenated from multiple passes — missing space after a period, or multiple paragraphs" })

  state.jobs.forEach((j, i) => {
    if (!j.employer) warns.push({ icon: "🏢", text: `Job #${i + 1}: employer name missing` })
    if (j.bullets.length > 6) warns.push({ icon: "⚠️", text: `Job #${i + 1} has ${j.bullets.length} bullets — max is 6` })
    j.bullets.forEach((b, bi) => {
      const t = b.text.trim()
      if (t.length > 10 && !bulletHasMetric(b.text)) {
        warns.push({ icon: "📊", text: `Job #${i + 1} bullet ${bi + 1}: no measurable metric` })
      }
      if (t.length > 10 && bulletHasWeakOpener(b.text)) {
        warns.push({ icon: "✍️", text: `Job #${i + 1} bullet ${bi + 1}: weak opener — start with a strong action verb` })
      }
      if (isEnvironmentTrailer(b.text)) {
        warns.push({ icon: "🗒️", text: `Job #${i + 1} bullet ${bi + 1}: standalone "Environment:" line — fold tools into a real bullet instead` })
      }
    })
  })

  const dupSkills = findDuplicateSkills(state.skillGroups)
  if (dupSkills.length) {
    warns.push({ icon: "🔁", text: `Skill${dupSkills.length !== 1 ? "s" : ""} listed in more than one category: ${dupSkills.slice(0, 5).join(", ")}` })
  }

  const pages = estimatePages(state)
  if (pages > 2.5) warns.push({ icon: "📄", text: `~${pages}p estimated — target is 2 pages` })

  return warns
}

// ─────────────────────────────────────────────────────────────────────────────
// .docx generation via JSZip + Open XML  (ATS-clean: no tables, no columns)
// ─────────────────────────────────────────────────────────────────────────────

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function wPara(runs: Array<[string, boolean?]>, opts?: { indentLeft?: number; spaceBefore?: number; borderBottom?: boolean }): string {
  const pPr = [
    opts?.borderBottom ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="222222"/></w:pBdr>` : "",
    opts?.spaceBefore ? `<w:spacing w:before="${opts.spaceBefore}" w:after="60"/>` : `<w:spacing w:after="60"/>`,
    opts?.indentLeft ? `<w:ind w:left="${opts.indentLeft}" w:hanging="180"/>` : "",
  ].filter(Boolean).join("")
  const rXml = runs.map(([text, bold]) =>
    `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`
  ).join("")
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${rXml}</w:p>`
}

function wSectionTitle(label: string): string {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="222222"/></w:pBdr><w:spacing w:before="200" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:caps/><w:sz w:val="18"/></w:rPr><w:t>${xmlEsc(label)}</w:t></w:r></w:p>`
}

function wBullet(text: string): string {
  return `<w:p><w:pPr><w:ind w:left="360" w:hanging="180"/><w:spacing w:after="40"/></w:pPr><w:r><w:t xml:space="preserve">• ${xmlEsc(text)}</w:t></w:r></w:p>`
}

function buildDocxXML(state: BuilderState): string {
  const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`
  const contact = [state.email, state.phone, state.linkedin, state.location].filter(Boolean).join("   |   ")
  const order = sectionOrder(state.roleType)

  const certsXML = state.certs.some(c => c.name.trim())
    ? wSectionTitle("Certifications") +
      wPara([[state.certs.filter(c => c.name.trim()).map(c => c.name + (c.date ? ` (${c.date})` : "")).join("   |   ")]])
    : ""

  const skillsXML = wSectionTitle("Technical Skills") +
    state.skillGroups.filter(g => g.skills.trim()).map(g =>
      `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${xmlEsc(g.category + ": ")}</w:t></w:r><w:r><w:t>${xmlEsc(g.skills)}</w:t></w:r></w:p>`
    ).join("")

  const expXML = wSectionTitle("Professional Experience") +
    state.jobs.filter(j => j.employer).map(j => {
      const dates = `${j.startDate}${j.startDate ? " – " : ""}${j.current ? "Present" : j.endDate}`
      return `<w:p><w:pPr><w:spacing w:before="140" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEsc(j.employer)}</w:t></w:r>
        <w:r><w:t xml:space="preserve">  —  ${xmlEsc(j.title)}</w:t></w:r>
        <w:r><w:rPr><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">   ${xmlEsc(dates)}</w:t></w:r>
      </w:p>
      ${j.location ? `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:color w:val="555555"/><w:i/></w:rPr><w:t>${xmlEsc(j.location)}</w:t></w:r></w:p>` : ""}
      ${j.bullets.filter(b => b.text.trim()).map(b => wBullet(b.text.trim())).join("")}`
    }).join("")

  const eduXML = state.eduSchool
    ? wSectionTitle("Education") +
      wPara([[state.eduDegree, true]]) +
      wPara([[`${state.eduSchool}${state.eduLocation ? ", " + state.eduLocation : ""}${state.eduDates ? "   |   " + state.eduDates : ""}`]])
    : ""

  const sections: Record<string, string> = {
    Summary: state.summary.trim() ? wSectionTitle("Summary") + wPara([[state.summary.trim()]]) : "",
    "Technical Skills": skillsXML,
    Certifications: certsXML,
    Experience: expXML,
    Education: eduXML,
  }

  const bodyContent = order.filter(s => s !== "Header" && s !== "Projects").map(s => sections[s] || "").join("")

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${xmlEsc(state.name)}</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr><w:t>${xmlEsc(state.targetRole)}</w:t></w:r></w:p>
    <w:p><w:pPr><w:spacing w:after="160"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="222222"/></w:pBdr></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="555555"/></w:rPr><w:t>${xmlEsc(contact)}</w:t></w:r></w:p>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="1080" w:bottom="720" w:left="1080"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

async function downloadDocx(state: BuilderState): Promise<void> {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const zip = new JSZip()
  zip.file("[Content_Types].xml", contentTypes)
  zip.file("_rels/.rels", rels)
  zip.file("word/document.xml", buildDocxXML(state))
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`)

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${state.name || "Resume"}_${state.targetRole || "Resume"}`.replace(/\s+/g, "_") + ".docx"
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Export preview (plain text)
// ─────────────────────────────────────────────────────────────────────────────

function buildResumeText(state: BuilderState): string {
  const order = sectionOrder(state.roleType)
  const lines: string[] = []

  lines.push(state.name.toUpperCase(), state.targetRole)
  const contact = [state.email, state.phone, state.linkedin, state.location].filter(Boolean).join(" | ")
  if (contact) lines.push(contact)
  lines.push("")

  for (const section of order) {
    if (section === "Header") continue

    if (section === "Summary" && state.summary.trim()) {
      lines.push("SUMMARY", "─".repeat(60))
      lines.push(state.summary.trim(), "")
    }

    if (section === "Technical Skills" && state.skillGroups.some(g => g.skills.trim())) {
      lines.push("TECHNICAL SKILLS", "─".repeat(60))
      state.skillGroups.filter(g => g.skills.trim()).forEach(g => {
        lines.push(`${g.category}: ${g.skills}`)
      })
      lines.push("")
    }

    if (section === "Certifications" && state.certs.some(c => c.name.trim())) {
      lines.push("CERTIFICATIONS", "─".repeat(60))
      state.certs.filter(c => c.name.trim()).forEach(c => {
        lines.push(`${c.name}${c.date ? ` — ${c.date}` : ""}`)
      })
      lines.push("")
    }

    if (section === "Experience") {
      lines.push("PROFESSIONAL EXPERIENCE", "─".repeat(60))
      state.jobs.forEach(j => {
        if (!j.employer) return
        lines.push(`${j.employer} | ${j.title}`)
        const dates = `${j.startDate} – ${j.current ? "Present" : j.endDate}`
        lines.push(`${j.location ? j.location + " | " : ""}${dates}`)
        j.bullets.filter(b => b.text.trim()).forEach(b => {
          lines.push(`• ${b.text.trim()}`)
        })
        lines.push("")
      })
    }

    if (section === "Education" && state.eduSchool.trim()) {
      lines.push("EDUCATION", "─".repeat(60))
      lines.push(state.eduDegree || "")
      lines.push(`${state.eduSchool}${state.eduLocation ? ", " + state.eduLocation : ""}${state.eduDates ? " | " + state.eduDates : ""}`)
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Resume Preview — FlowCV-style styled HTML render
// ─────────────────────────────────────────────────────────────────────────────

function ResumePreview({ state }: { state: BuilderState }) {
  const order = sectionOrder(state.roleType)

  const sectionStyle: React.CSSProperties = { marginBottom: 14 }
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#1558a0", borderBottom: "1.5px solid #1558a0", paddingBottom: 2,
    marginBottom: 7, fontFamily: "Arial, sans-serif",
  }
  const bulletStyle: React.CSSProperties = {
    fontSize: 9.5, lineHeight: 1.55, color: "#2d3748", marginBottom: 3,
    paddingLeft: 12, position: "relative", fontFamily: "Arial, sans-serif",
  }

  function renderSection(name: string) {
    switch (name) {
      case "Header": return null // rendered separately
      case "Summary":
        if (!state.summary.trim()) return null
        return (
          <div key="summary" style={sectionStyle}>
            <div style={sectionHeadStyle}>Professional Summary</div>
            <p style={{ fontSize: 9.5, lineHeight: 1.6, color: "#2d3748", fontFamily: "Arial, sans-serif" }}>{state.summary}</p>
          </div>
        )
      case "Certifications":
        if (!state.certs.some(c => c.name.trim())) return null
        return (
          <div key="certs" style={sectionStyle}>
            <div style={sectionHeadStyle}>Certifications</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              {state.certs.filter(c => c.name.trim()).map(c => (
                <span key={c.id} style={{ fontSize: 9.5, color: "#2d3748", fontFamily: "Arial, sans-serif" }}>
                  ▸ {c.name}{c.date ? ` (${c.date})` : ""}
                </span>
              ))}
            </div>
          </div>
        )
      case "Technical Skills":
        if (!state.skillGroups.some(sg => sg.skills.trim())) return null
        return (
          <div key="skills" style={sectionStyle}>
            <div style={sectionHeadStyle}>Technical Skills</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {state.skillGroups.filter(sg => sg.skills.trim()).map(sg => (
                <div key={sg.id} style={{ fontSize: 9.5, color: "#2d3748", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
                  {sg.category && <strong style={{ color: "#1a2035" }}>{sg.category}: </strong>}
                  {sg.skills}
                </div>
              ))}
            </div>
          </div>
        )
      case "Experience":
        if (!state.jobs.some(j => j.employer.trim())) return null
        return (
          <div key="experience" style={sectionStyle}>
            <div style={sectionHeadStyle}>Professional Experience</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {state.jobs.filter(j => j.employer.trim()).map(j => (
                <div key={j.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#1a2035", fontFamily: "Arial, sans-serif" }}>
                      {j.employer}
                    </span>
                    <span style={{ fontSize: 9, color: "#6b7280", fontFamily: "Arial, sans-serif" }}>
                      {j.startDate}{j.startDate && (j.endDate || j.current) ? " – " : ""}{j.current ? "Present" : j.endDate}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9.5, fontStyle: "italic", color: "#4a5568", fontFamily: "Arial, sans-serif" }}>
                      {j.title}{j.location ? ` · ${j.location}` : ""}
                    </span>
                  </div>
                  {j.bullets.filter(b => b.text.trim()).map(b => (
                    <div key={b.id} style={bulletStyle}>
                      <span style={{ position: "absolute", left: 2, top: 0 }}>•</span>
                      {b.text}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      case "Education":
        if (!state.eduSchool.trim() && !state.eduDegree.trim()) return null
        return (
          <div key="education" style={sectionStyle}>
            <div style={sectionHeadStyle}>Education</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#1a2035", fontFamily: "Arial, sans-serif" }}>
                {state.eduSchool || "Institution"}
              </span>
              <span style={{ fontSize: 9, color: "#6b7280", fontFamily: "Arial, sans-serif" }}>
                {state.eduDates}{state.eduLocation ? ` · ${state.eduLocation}` : ""}
              </span>
            </div>
            {state.eduDegree && (
              <p style={{ fontSize: 9.5, color: "#4a5568", marginTop: 1, fontFamily: "Arial, sans-serif" }}>{state.eduDegree}</p>
            )}
          </div>
        )
      case "Projects":
        return null // not implemented in form yet
      default:
        return null
    }
  }

  const hasContent = state.name || state.targetRole || state.summary || state.jobs.some(j => j.employer)

  return (
    <div style={{
      background: "#f1f5f9", borderRadius: 12, padding: "12px 10px",
      minHeight: 600, display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <p style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Live Preview
      </p>
      <div style={{
        background: "#fff", width: "100%", maxWidth: 540,
        minHeight: 700, borderRadius: 4,
        boxShadow: "0 4px 24px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08)",
        padding: "28px 30px 36px",
        fontFamily: "Arial, sans-serif",
      }}>
        {!hasContent ? (
          <div style={{ textAlign: "center", paddingTop: 120, color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <p style={{ fontSize: 11, fontWeight: 600 }}>Fill in the form to see your resume preview</p>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div style={{ textAlign: "center", marginBottom: 14, borderBottom: "2px solid #1558a0", paddingBottom: 10 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "#1a2035", letterSpacing: "-0.3px", marginBottom: 2, fontFamily: "Arial, sans-serif" }}>
                {state.name || "Your Name"}
              </h1>
              {state.targetRole && (
                <p style={{ fontSize: 11, fontWeight: 600, color: "#1558a0", marginBottom: 5, fontFamily: "Arial, sans-serif" }}>
                  {state.targetRole}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2px 12px", fontSize: 9, color: "#4a5568", fontFamily: "Arial, sans-serif" }}>
                {state.email && <span>{state.email}</span>}
                {state.phone && <span>{state.phone}</span>}
                {state.location && <span>{state.location}</span>}
                {state.linkedin && <span>{state.linkedin}</span>}
                {state.visaCategory && <span>| {state.visaCategory}</span>}
              </div>
            </div>

            {/* ── Sections in order ── */}
            {order.filter(s => s !== "Header").map(name => renderSection(name))}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ResumeBuilder component
// ─────────────────────────────────────────────────────────────────────────────

export default function ResumeBuilder() {
  const { confirm } = useDialogs()
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState("")

  // ── Smart Fill state ──────────────────────────────────────────────────────
  const [fillStatus, setFillStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [resumeList, setResumeList] = useState<Array<{ filename: string; filepath: string }>>([])
  const [showResumePicker, setShowResumePicker] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didMount = useRef(false)

  // Auto-restore draft from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mf_resume_builder_draft")
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BuilderState>
        if (parsed && typeof parsed === "object" && (parsed.name || parsed.email)) {
          setState(prev => ({ ...prev, ...parsed }))
        }
      }
    } catch { /* ignore */ }
    didMount.current = true
  }, [])

  // Auto-save draft to localStorage (debounced 1.5 s)
  useEffect(() => {
    if (!didMount.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem("mf_resume_builder_draft", JSON.stringify(state)) } catch { /* ignore */ }
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [state])

  // Load user's uploaded resume list for "Import from resume"
  useEffect(() => {
    fetch("/api/resumes")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.files) setResumeList(data.files) })
      .catch(() => {})
  }, [])

  // Auto-fill from saved Supabase profile on mount (non-blocking)
  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const p = data?.profile
        if (!p) return
        setState(prev => ({
          ...prev,
          name:       prev.name       || p.full_name || "",
          email:      prev.email      || p.email     || "",
          phone:      prev.phone      || p.phone     || "",
          linkedin:   prev.linkedin   || (p.linkedin ? p.linkedin.replace(/^https?:\/\//i, "") : ""),
          location:   prev.location   || p.location  || "",
          targetRole: prev.targetRole || p.title     || "",
        }))
        setFillStatus("loaded")
        setTimeout(() => setFillStatus("idle"), 3000)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fillFromProfile() {
    setFillStatus("loading")
    try {
      const r = await fetch("/api/profile")
      if (!r.ok) throw new Error("fetch failed")
      const { profile: p } = await r.json()
      if (!p) throw new Error("no profile")
      setState(prev => ({
        ...prev,
        name:       p.full_name || prev.name       || "",
        email:      p.email     || prev.email      || "",
        phone:      p.phone     || prev.phone      || "",
        linkedin:   p.linkedin  ? p.linkedin.replace(/^https?:\/\//i, "") : prev.linkedin || "",
        location:   p.location  || prev.location   || "",
        targetRole: p.title     || prev.targetRole || "",
      }))
      setFillStatus("loaded")
      setTimeout(() => setFillStatus("idle"), 3000)
    } catch {
      setFillStatus("error")
      setTimeout(() => setFillStatus("idle"), 3000)
    }
  }

  async function fillFromResume(filepath: string) {
    setFillStatus("loading")
    setShowResumePicker(false)
    try {
      const r = await fetch(`/api/profile?filepath=${encodeURIComponent(filepath)}`)
      if (!r.ok) throw new Error("fetch failed")
      const { profile: p } = await r.json()
      if (!p) throw new Error("no profile")
      setState(prev => ({
        ...prev,
        name:       p.full_name || prev.name       || "",
        email:      p.email     || prev.email      || "",
        phone:      p.phone     || prev.phone      || "",
        linkedin:   p.linkedin  ? p.linkedin.replace(/^https?:\/\//i, "") : prev.linkedin || "",
        location:   p.location  || prev.location   || "",
        targetRole: p.title     || prev.targetRole || "",
      }))
      setFillStatus("loaded")
      setTimeout(() => setFillStatus("idle"), 3000)
    } catch {
      setFillStatus("error")
      setTimeout(() => setFillStatus("idle"), 3000)
    }
  }

  async function clearForm() {
    if (!await confirm("Clear all form data and start a fresh resume?", { title: "Start fresh resume", confirmLabel: "Clear", destructive: true })) return
    setState(DEFAULT_STATE)
    try { localStorage.removeItem("mf_resume_builder_draft") } catch { /* ignore */ }
    setFillStatus("idle")
  }

  function duplicateJob(id: string) {
    setState(prev => {
      const idx = prev.jobs.findIndex(j => j.id === id)
      if (idx === -1) return prev
      const src = prev.jobs[idx]
      const copy: JobEntry = { ...src, id: uid(), employer: src.employer + " (copy)", bullets: src.bullets.map(b => ({ ...b, id: uid() })) }
      const jobs = [...prev.jobs]
      jobs.splice(idx + 1, 0, copy)
      return { ...prev, jobs }
    })
  }

  function moveJob(id: string, dir: -1 | 1) {
    setState(prev => {
      const idx = prev.jobs.findIndex(j => j.id === id)
      const next = idx + dir
      if (next < 0 || next >= prev.jobs.length) return prev
      const jobs = [...prev.jobs]
      ;[jobs[idx], jobs[next]] = [jobs[next], jobs[idx]]
      return { ...prev, jobs }
    })
  }

  const set = useCallback(<K extends keyof BuilderState>(k: K, v: BuilderState[K]) => {
    setState(prev => ({ ...prev, [k]: v }))
  }, [])

  function applyPreset(roleName: string) {
    const preset = ROLE_PRESETS[roleName]
    if (!preset) return
    setState(prev => ({
      ...prev,
      targetRole: roleName,
      roleType: preset.type,
      skillGroups: preset.skillGroups,
      certs: preset.certSuggestions.map(n => ({ id: uid(), name: n, date: "" })),
    }))
  }

  function addJob() {
    setState(prev => ({ ...prev, jobs: [...prev.jobs, blankJob()] }))
  }

  function updateJob(id: string, j: JobEntry) {
    setState(prev => ({ ...prev, jobs: prev.jobs.map(x => x.id === id ? j : x) }))
  }

  function removeJob(id: string) {
    setState(prev => ({ ...prev, jobs: prev.jobs.filter(x => x.id !== id) }))
  }

  function addSkillGroup() {
    setState(prev => ({ ...prev, skillGroups: [...prev.skillGroups, { id: uid(), category: "", skills: "" }] }))
  }

  function updateSkillGroup(id: string, k: keyof SkillGroup, v: string) {
    setState(prev => ({
      ...prev,
      skillGroups: prev.skillGroups.map(sg => sg.id === id ? { ...sg, [k]: v } : sg),
    }))
  }

  function removeSkillGroup(id: string) {
    setState(prev => ({ ...prev, skillGroups: prev.skillGroups.filter(sg => sg.id !== id) }))
  }

  function addCert() {
    setState(prev => ({ ...prev, certs: [...prev.certs, { id: uid(), name: "", date: "" }] }))
  }

  function updateCert(id: string, k: "name" | "date", v: string) {
    setState(prev => ({ ...prev, certs: prev.certs.map(c => c.id === id ? { ...c, [k]: v } : c) }))
  }

  function removeCert(id: string) {
    setState(prev => ({ ...prev, certs: prev.certs.filter(c => c.id !== id) }))
  }

  function copyText() {
    navigator.clipboard.writeText(buildResumeText(state)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleDownloadDocx() {
    if (!state.name && !state.targetRole) {
      setDlError("Fill in at least a name and role before downloading.")
      setTimeout(() => setDlError(""), 4000)
      return
    }
    setDlError("")
    setDownloading(true)
    try { await downloadDocx(state) } finally { setDownloading(false) }
  }

  const warnings = validateBuilder(state)
  const pages = estimatePages(state)
  const summaryWords = countWords(state.summary)

  const pageColor = pages <= 2 ? "var(--accent)" : pages <= 2.5 ? "#d97706" : "#ef4444"

  return (
    <div className="space-y-6">
      {/* ── Hero banner with illustration ── */}
      <div
        className="rounded-2xl overflow-hidden flex items-center gap-6 px-6 py-5"
        style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)", border: "1px solid #BFDBFE" }}
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold" style={{ color: "#1e3a5f" }}>Resume Builder</h2>
          <p className="text-sm mt-1" style={{ color: "#4b6a8e" }}>
            Build ATS-ready resumes with every defect from your reference library pre-fixed — no "Having" openers, metrics in every bullet, 2-page limit enforced.
          </p>
        </div>
        <IllustBuilder style={{ width: 160, height: 120, flexShrink: 0, borderRadius: 12 }}/>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold"
            style={{
              borderColor: pageColor, color: pageColor,
              background: `color-mix(in srgb, ${pageColor} 10%, transparent)`,
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            ~{pages} page{pages !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={copyText} className="btn-outline px-3 py-1.5 text-sm">
            {copied ? "✓ Copied!" : "Copy Text"}
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={downloading}
            className="btn-accent px-4 py-1.5 text-sm flex items-center gap-1.5"
            style={{ opacity: downloading ? 0.7 : 1 }}
          >
            {downloading ? (
              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating…</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download .docx</>
            )}
          </button>
        </div>
        {dlError && (
          <p className="text-xs mt-2 text-right" style={{ color: "var(--error, #dc2626)" }}>{dlError}</p>
        )}
      </div>

      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <div
          className="rounded-xl border p-4 space-y-1.5"
          style={{ background: "rgba(245,158,11,.07)", borderColor: "rgba(245,158,11,.3)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#d97706" }}>
            {warnings.length} Issue{warnings.length !== 1 ? "s" : ""} to fix before export
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs flex gap-2" style={{ color: "var(--text-muted)" }}>
              <span>{w.icon}</span>
              {w.text}
            </p>
          ))}
        </div>
      )}

      {/* ── Split-pane: Form left, Live preview right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%", gap: 24, alignItems: "start" }}>

        {/* ── FORM COLUMN (stacked single-column) ── */}
        <div className="space-y-5" style={{ minWidth: 0 }}>

          {/* All form sections stacked */}
          <div className="space-y-5">

          {/* ── Smart Fill convenience panel ────────────────────────────────── */}
          <div
            className="rounded-xl border p-4"
            style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%)", borderColor: "#bfdbfe" }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1558a0" }}>⚡ Smart Fill</p>
                <p className="text-xs mt-0.5" style={{ color: "#4b6a8e" }}>Auto-populate your contact details from saved profile or an uploaded resume.</p>
              </div>
              {autoSaved && (
                <span className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: "#dbeafe", color: "#1e3a5f" }}>
                  ✓ Draft saved
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Load from Supabase profile */}
              <button
                onClick={() => void fillFromProfile()}
                disabled={fillStatus === "loading"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  background: fillStatus === "loaded" ? "#dbeafe" : fillStatus === "error" ? "#fee2e2" : "#fff",
                  borderColor: fillStatus === "loaded" ? "#bfdbfe" : fillStatus === "error" ? "#fca5a5" : "#bfdbfe",
                  color: fillStatus === "loaded" ? "#1e3a5f" : fillStatus === "error" ? "#dc2626" : "#1558a0",
                  opacity: fillStatus === "loading" ? 0.6 : 1,
                }}
              >
                {fillStatus === "loading" ? (
                  <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading…</>
                ) : fillStatus === "loaded" ? "✓ Profile Loaded" : fillStatus === "error" ? "✗ No profile found" : "👤 Load from Profile"}
              </button>

              {/* Import from uploaded resume */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowResumePicker(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={{ background: "#fff", borderColor: "#bfdbfe", color: "#1558a0" }}
                >
                  📄 Import from Resume {resumeList.length > 0 ? `(${resumeList.length})` : ""}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                {showResumePicker && (
                  <div
                    className="absolute z-50 mt-1 rounded-xl border shadow-xl py-1"
                    style={{ left: 0, top: "100%", minWidth: 260, background: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    {resumeList.length === 0 ? (
                      <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)" }}>No resumes uploaded yet.</p>
                    ) : resumeList.map(r => (
                      <button
                        key={r.filepath}
                        onClick={() => void fillFromResume(r.filepath)}
                        className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-opacity-50 transition-colors"
                        style={{ color: "var(--text)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        📄 {r.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }} />

              {/* Clear form */}
              <button
                onClick={clearForm}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{ background: "transparent", borderColor: "var(--border)", color: "var(--text-soft)" }}
              >
                🗑 Clear
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "#7ea3c4" }}>
              Draft auto-saved locally · Your work won't be lost on refresh
            </p>
          </div>

          {/* meta/header/summary/certs/edu ── */}
          <div className="space-y-5">

            {/* Role template presets */}
            <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Role Template" />
              <div className="space-y-1.5">
                {Object.keys(ROLE_PRESETS).map(name => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: state.targetRole === name ? "var(--accent-soft)" : "var(--surface-2)",
                      color: state.targetRole === name ? "var(--accent-txt)" : "var(--text-muted)",
                      borderLeft: state.targetRole === name ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-soft)" }}>
                Applies pre-seeded skill categories and cert suggestions.
              </p>
            </div>

            {/* Candidate info */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Candidate Info" />
              <Field label="Full Name" required>
                <Input value={state.name} onChange={v => set("name", v)} placeholder="e.g. Alex Johnson" />
              </Field>
              <Field label="Target Role Title" required>
                <Input value={state.targetRole} onChange={v => set("targetRole", v)} placeholder="e.g. OT Security Engineer" />
              </Field>
              <Field label="Email" required hint="One canonical email per candidate — never mix across resumes">
                <Input value={state.email} onChange={v => set("email", v)} type="email" placeholder="e.g. alex.johnson@email.com" />
              </Field>
              <Field label="Phone">
                <Input value={state.phone} onChange={v => set("phone", v)} placeholder="(555) 012-3456" />
              </Field>
              <Field label="LinkedIn">
                <Input value={state.linkedin} onChange={v => set("linkedin", v)} placeholder="linkedin.com/in/alexj" />
              </Field>
              <Field label="Location">
                <Input value={state.location} onChange={v => set("location", v)} placeholder="Austin, TX" />
              </Field>
              <Field label="Visa / Work Auth">
                <select
                  value={state.visaCategory}
                  onChange={e => set("visaCategory", e.target.value)}
                  className="ring-accent w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)", outline: "none" }}
                >
                  <option value="">Select…</option>
                  <option>Green Card (GC)</option>
                  <option>H-1B Sponsor Required</option>
                  <option>OPT / CPT</option>
                  <option>US Citizen</option>
                  <option>C2C / Corp-to-Corp</option>
                  <option>W2 Only</option>
                </select>
              </Field>
              <Field label="Role Type (drives section order)">
                <div className="flex gap-2">
                  {(["security", "other"] as RoleType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => set("roleType", t)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold border"
                      style={{
                        background: state.roleType === t ? "var(--accent-soft)" : "var(--surface-2)",
                        borderColor: state.roleType === t ? "var(--accent)" : "var(--border)",
                        color: state.roleType === t ? "var(--accent-txt)" : "var(--text-muted)",
                      }}
                    >
                      {t === "security" ? "🔒 Security" : "🛠 General"}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-soft)" }}>
                  Security → Certs before Experience. General → Certs at end.
                </p>
              </Field>
            </div>

            {/* Summary */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Professional Summary">
                <span
                  className="text-xs font-semibold"
                  style={{ color: summaryWords > 80 ? "#ef4444" : summaryWords > 60 ? "#d97706" : "var(--text-soft)" }}
                >
                  {summaryWords}/80 words
                </span>
              </SectionHeader>
              <Textarea
                value={state.summary}
                onChange={v => set("summary", v)}
                rows={5}
                placeholder="[Title] with [N]+ years of [domain] experience specializing in [key strength]. Proven track record of [achievement]. Expert in [tool/framework] with [cert/credential]."
                warn={
                  hasHavingOpener(state.summary)
                    ? 'Starts with "Having" — recruiters flag this as AI-generated. Rewrite.'
                    : summaryWords > 80
                    ? `${summaryWords - 80} words over the 80-word limit`
                    : undefined
                }
              />
              <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                Single paragraph only. No concatenated AI outputs. Never start with "Having X years".
              </p>
            </div>

            {/* Certifications */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Certifications">
                <button onClick={addCert} className="btn-ghost text-xs px-2 py-1">+ Add</button>
              </SectionHeader>
              {state.certs.map(c => (
                <div key={c.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input value={c.name} onChange={v => updateCert(c.id, "name", v)} placeholder="e.g. OSCP, CISSP, AZ-500" />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <Input value={c.date} onChange={v => updateCert(c.id, "date", v)} placeholder="Oct 2024" />
                  </div>
                  <button onClick={() => removeCert(c.id)} className="btn-ghost p-2 mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>✕</button>
                </div>
              ))}
              <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                Security roles: certs appear before Experience (high recruiter scan priority).
              </p>
            </div>

            {/* Education */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Education" />
              <Field label="Degree">
                <Input value={state.eduDegree} onChange={v => set("eduDegree", v)} placeholder="MS Computer Science" />
              </Field>
              <Field label="Institution">
                <Input value={state.eduSchool} onChange={v => set("eduSchool", v)} placeholder="Saint Louis University" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dates">
                  <Input value={state.eduDates} onChange={v => set("eduDates", v)} placeholder="Aug 2022 – May 2024" />
                </Field>
                <Field label="Location">
                  <Input value={state.eduLocation} onChange={v => set("eduLocation", v)} placeholder="St. Louis, MO" />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Skills + Jobs ── */}
          <div className="space-y-5">

            {/* Technical Skills */}
            <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <SectionHeader label="Technical Skills">
                <button onClick={addSkillGroup} className="btn-ghost text-xs px-2 py-1">+ Category</button>
              </SectionHeader>
              <p className="text-xs -mt-1 mb-2" style={{ color: "var(--text-soft)" }}>
                One skills section, one format. No duplicates across categories.
              </p>
              {state.skillGroups.map(sg => (
                <div key={sg.id} className="flex gap-2 items-start">
                  <div className="w-44 flex-shrink-0">
                    <Input value={sg.category} onChange={v => updateSkillGroup(sg.id, "category", v)} placeholder="Category name" />
                  </div>
                  <div className="flex-1">
                    <Input value={sg.skills} onChange={v => updateSkillGroup(sg.id, "skills", v)} placeholder="Tool A, Tool B, Framework C" />
                  </div>
                  <button onClick={() => removeSkillGroup(sg.id)} className="btn-ghost p-2 mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>✕</button>
                </div>
              ))}
            </div>

            {/* Experience */}
            <div className="space-y-3">
              <SectionHeader label={`Experience (${state.jobs.length} role${state.jobs.length !== 1 ? "s" : ""})`}>
                <button onClick={addJob} className="btn-outline text-xs px-3 py-1.5">+ Add Role</button>
              </SectionHeader>
              {state.jobs.map((j, i) => (
                <JobEntryBlock
                  key={j.id}
                  job={j}
                  index={i}
                  onUpdate={updated => updateJob(j.id, updated)}
                  onRemove={() => removeJob(j.id)}
                  canRemove={state.jobs.length > 1}
                  onDuplicate={() => duplicateJob(j.id)}
                  onMoveUp={() => moveJob(j.id, -1)}
                  onMoveDown={() => moveJob(j.id, 1)}
                  isFirst={i === 0}
                  isLast={i === state.jobs.length - 1}
                />
              ))}
            </div>

            {/* Section order preview */}
            <div
              className="rounded-xl border p-4"
              style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent-txt)" }}>
                Section Order ({state.roleType === "security" ? "Security Role" : "General Role"})
              </p>
              <div className="flex flex-wrap gap-2">
                {sectionOrder(state.roleType).map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-md"
                      style={{ background: "var(--accent)", color: "#fff", opacity: 0.85 + i * 0.02 }}
                    >
                      {s}
                    </span>
                    {i < sectionOrder(state.roleType).length - 1 && (
                      <span className="text-xs" style={{ color: "var(--accent-txt)" }}>→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>{/* end inner form grid */}
        </div>{/* end form column */}

        {/* ── LIVE PREVIEW COLUMN ── */}
        <div style={{ position: "sticky", top: 24 }}>
          <ResumePreview state={state} />
        </div>

      </div>{/* end split-pane */}
    </div>
  )
}
