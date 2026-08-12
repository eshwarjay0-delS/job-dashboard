import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { extractProfile, type Profile } from "@/lib/profile"
import { createClientFromRequest } from "@/lib/supabase/server"
import { TAILORED_DIR as OUT_DIR, USER_RESUMES_DIR as USER_RESUMES_BASE, RESUMES_LIB as LEGACY_RESUMES } from "@/lib/paths"
import { readPath, listFiles, statPath } from "@/lib/storage"

export const runtime = "nodejs"

// The extension's autofill reads Supabase-style field names (full_name, portfolio,
// bio, …). A resume-extracted Profile uses different names (name, website, …), so
// normalize it to the shape content.js / popup.js actually consume — otherwise the
// form fills nothing.
function toAutofillShape(p: Profile) {
  const url = (u: string) => (u ? (/^https?:\/\//i.test(u) ? u : "https://" + u) : "")
  return {
    full_name: p.name || "",
    first_name: p.firstName || "",
    last_name: p.lastName || "",
    title: p.title || "",
    email: p.email || "",
    phone: p.phone || "",
    location: p.location || "",
    linkedin: url(p.linkedin),
    github: url(p.github),
    portfolio: url(p.website),
    skills: p.skills || [],
    years_experience: p.yearsExperience || "",
    // Extension fills ATS "Work Authorization" dropdowns from these.
    // Resume extraction can't determine visa status, so we leave them empty
    // here — logged-in users get the real values from Supabase (line 102 above).
    work_auth: "",
    visa_status: "",
  }
}

// Find the most recently modified .docx under a directory tree (best-effort).
async function newestDocx(dir: string): Promise<string | null> {
  const files = (await listFiles(dir)).filter(f => f.toLowerCase().endsWith(".docx"))
  let best: { p: string; m: number } | null = null
  for (const f of files) {
    const s = await statPath(f)
    if (s && (!best || s.mtime.getTime() > best.m)) best = { p: f, m: s.mtime.getTime() }
  }
  return best?.p ?? null
}

// GET ?filepath= or ?token= → extract profile from that resume (extension autofill)
// GET (no params)           → the logged-in user's saved profile, else fall back to
//                             extracting one from their newest resume (works without login)
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams
  const filepath = sp.get("filepath") || ""
  const token = sp.get("token") || ""

  if (filepath || token) {
    try {
      // Scope filepath access to the current user's own folder only
      let userId = "demo"
      try {
        const supabase = await createClientFromRequest(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) userId = user.id
      } catch { /* unauthenticated — stay as "demo" */ }

      let resolved: string
      if (token) {
        resolved = path.join(OUT_DIR, path.basename(token) + ".docx")
      } else {
        resolved = path.resolve(filepath)
        // Allow: tailored output dir, THIS user's resume folder, legacy library
        const allowed = [
          path.resolve(OUT_DIR),
          path.resolve(path.join(USER_RESUMES_BASE, userId)),
          path.resolve(LEGACY_RESUMES),
        ]
        if (!allowed.some(a => resolved.startsWith(a + path.sep) || resolved === a)) {
          return NextResponse.json({ error: "That file is outside your resumes folder." }, { status: 403 })
        }
      }
      const buf = await readPath(resolved)
      if (!buf) return NextResponse.json({ error: "That resume could not be read." }, { status: 404 })
      const profile = toAutofillShape(await extractProfile(buf))
      return NextResponse.json({ profile })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }

  // No params: prefer the saved dashboard profile (matches the autofill shape already).
  let userId = "demo"
  try {
    const supabase = await createClientFromRequest(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
      if (data && (data.full_name || data.email)) return NextResponse.json({ profile: data })
    }
  } catch { /* unauthenticated → resume fallback below */ }

  // Fallback (no login / empty profile): pull contact details from the newest resume.
  // Scoped to THIS user's folder + the shared legacy library only — never the bare
  // USER_RESUMES_BASE root, which recurses into every user's subfolder and would
  // leak whichever real user most recently uploaded a resume (name/email/phone)
  // to an unauthenticated caller now that this route is public (see middleware.ts).
  try {
    const dirs = [path.join(USER_RESUMES_BASE, userId), LEGACY_RESUMES]
    for (const dir of dirs) {
      const newest = await newestDocx(dir)
      if (newest) {
        const buf = await readPath(newest)
        if (buf) {
          const profile = toAutofillShape(await extractProfile(buf))
          if (profile.full_name || profile.email) return NextResponse.json({ profile, source: "resume" })
        }
      }
    }
  } catch { /* fall through */ }

  return NextResponse.json({ profile: null })
}

// POST — save the logged-in user's profile
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: body.name ?? null,
        phone: body.phone ?? null,
        whatsapp: body.whatsapp ?? null,
        location: body.location ?? null,
        linkedin: body.linkedin ?? null,
        github: body.github ?? null,
        portfolio: body.portfolio ?? null,
        title: body.title ?? null,
        bio: body.bio ?? null,
        visa_status: body.visaStatus ?? null,
        work_auth: body.workAuth ?? null,
        skills: body.skills ?? null,
        // Tri-state (null = not answered yet) so the extension only auto-fills
        // a form's Yes/No radio once the user has actually stated a preference
        // — never defaults an unanswered question to "No". remote_ok/relo_ok
        // used to default to false; now the Settings form always sends an
        // explicit true/false/null, so preserve that instead of collapsing
        // "unanswered" into "No".
        remote_ok: body.remoteOk ?? null,
        relo_ok: body.reloOk ?? null,
        start_immediately: body.startImmediately ?? null,
        has_transportation: body.hasTransportation ?? null,
        has_clearance: body.hasClearance ?? null,
        salary_min: body.salaryMin ?? null,
        salary_max: body.salaryMax ?? null,
        open_to_roles: body.openToRoles ?? null,
        job_types: body.jobTypes ?? null,
        profile_complete: body.profileComplete ?? false,
      },
      { onConflict: "id" },
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
