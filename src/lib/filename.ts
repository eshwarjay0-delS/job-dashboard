// Build download filenames for tailored resumes, mirroring the user's library
// convention (JobRight-style): "<Candidate>_<Role or Company>_<YYYYMMDD>".
//
// The key idea: the filename must describe the TARGET job the resume was
// tailored for — not the source resume's original role. So a "IAM Engineer"
// base tailored to a SOC role at Avenue Code downloads as
// "Eshwar Arya_Avenue Code_20260727.docx", with a fresh date stamp.

// Chars we allow in the human-readable middle segment. Keep "&()+.- " so titles
// like "Cyber Security Control Testing & Validation Associate" survive intact.
const SAFE_LABEL = /[^a-zA-Z0-9 &()+.\-]/g
// Final filesystem sanitize (underscore is the segment separator, so keep it).
const SAFE_FILE = /[^a-zA-Z0-9 &()+._\-]/g

export function yyyymmdd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

// Candidate name from a source resume filename: the segment before the first
// "_". Library files are named "Eshwar Arya_<role/company>_<date>", so the
// prefix is the person's name. Returns "" when there's no separator.
export function candidateFromSource(sourceName: string): string {
  if (!sourceName) return ""
  return (sourceName.split("_")[0] ?? "").trim()
}

// Shorten a role/company label so filenames stay reasonable, trimming at a word
// boundary rather than mid-word.
export function abbreviate(label: string, max = 48): string {
  const clean = (label || "").replace(SAFE_LABEL, " ").replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).replace(/\s+\S*$/, "").trim()
}

// Best-effort role/company extraction from a raw job description. Conservative:
// returns blanks when nothing confident is found, so callers can fall back to an
// explicitly-known value (e.g. the job card the user tailored from).
export function extractRoleCompany(jd: string): { role: string; company: string } {
  const text = (jd || "").replace(/\r/g, "")
  const firstLines = text.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 8)

  let role = ""
  let company = ""

  // Labelled fields anywhere in the JD ("Job Title: X", "Position - X", "Role: X").
  const roleLabel = text.match(/\b(?:job title|position|role|title)\s*[:\-–]\s*(.+)/i)
  if (roleLabel) role = roleLabel[1].split(/[|\n·•]/)[0].trim()
  const compLabel = text.match(/\b(?:company|employer|organization|organisation)\s*[:\-–]\s*(.+)/i)
  if (compLabel) company = compLabel[1].split(/[|\n·•]/)[0].trim()

  // "at <Company>" / "join <Company>" / "<Company> is hiring".
  if (!company) {
    const at = text.match(/\b(?:at|join|with)\s+([A-Z][A-Za-z0-9.&' -]{1,40}?)(?:\s+(?:is|as|in|for|we|to|—|-|\.|,|\n))/)
    if (at) company = at[1].trim()
  }
  if (!company) {
    const hiring = text.match(/\b([A-Z][A-Za-z0-9.&' -]{1,40}?)\s+is\s+(?:hiring|looking|seeking)/)
    if (hiring) company = hiring[1].trim()
  }

  // Role fallback: the first short-ish line that reads like a title.
  if (!role) {
    const titleLike = firstLines.find(l =>
      l.length <= 60 &&
      /[A-Za-z]/.test(l) &&
      !/[.!?]$/.test(l) &&
      /\b(engineer|analyst|developer|manager|specialist|architect|administrator|consultant|associate|lead|director|tester|scientist|designer|coordinator|intern)\b/i.test(l),
    )
    if (titleLike) role = titleLike
  }

  return { role: role.slice(0, 60).trim(), company: company.slice(0, 40).trim() }
}

// Assemble the final download base name (no extension). Prefers company (most
// identifying), else role; always ends in a date stamp.
export function tailoredFilename(opts: {
  sourceName?: string
  candidate?: string
  role?: string
  company?: string
  date?: Date
}): string {
  const candidate = (opts.candidate || candidateFromSource(opts.sourceName || "")).trim()
  const target = abbreviate((opts.company || "").trim() || (opts.role || "").trim())
  const stamp = yyyymmdd(opts.date)
  const base = [candidate, target].filter(Boolean).join("_")
  const withStamp = base ? `${base}_${stamp}` : `Resume_${stamp}`
  return withStamp.replace(SAFE_FILE, "_").replace(/\s+/g, " ").trim()
}
