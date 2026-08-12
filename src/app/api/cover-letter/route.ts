import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { readPath } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { matchByKeywords } from "@/lib/keywords"
import { resolveKeys, hasAnyKey, callLLM } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"
import { USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { checkRateLimit, clientIp } from "@/lib/rateLimit"

export const runtime = "nodejs"

async function getUserResumeDir(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return path.join(USER_RESUMES_BASE, data.user?.id ?? "demo")
  } catch { return path.join(USER_RESUMES_BASE, "demo") }
}

const TONE_GUIDE: Record<string, string> = {
  professional:   "polished and formal, confident but not stiff",
  conversational: "warm and human, first-person, lightly conversational while still professional",
  technical:      "precise and technical, leading with concrete tools, systems, and outcomes",
}

// Generate a real, resume-grounded cover letter from the JD — NOT a [BRACKET] template.
// Grounded in the candidate's actual resume so it never fabricates experience.
export async function POST(request: NextRequest) {
  try {
    // 5 cover letters per hour per IP — LLM-heavy, ~600 tokens each
    const rl = checkRateLimit(`cover-letter:${clientIp(request)}`, { max: 5, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      )
    }

    const body = await request.json().catch(() => ({}))
    const jd = (body.jd || "").trim()
    const company = (body.company || "").trim()
    const role = (body.role || "").trim()
    const tone = (TONE_GUIDE[body.tone] ? body.tone : "professional") as string

    if (!jd && !role) {
      return NextResponse.json({ error: "Paste the job description (or at least the role) first." }, { status: 400 })
    }

    const keys = resolveKeys(body)
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "No API key found. Add a Claude, OpenRouter, or Gemini key in Settings or .env.local." },
        { status: 400 },
      )
    }

    // Ground the letter in the candidate's real resume: the one they picked, or the
    // best match for the JD from their library (reusing the tailoring selector).
    const userResumeDir = await getUserResumeDir()
    let resumeText = ""
    let resumeName = ""
    try {
      let filepath = (body.filepath || "").trim()
      if (!filepath && jd) {
        const m = await matchByKeywords(jd, undefined, userResumeDir)
        if (m?.best) { filepath = m.best.filepath; resumeName = m.best.filename }
      }
      if (filepath) {
        const resolved = path.resolve(filepath)
        if (resolved.startsWith(path.resolve(userResumeDir))) {
          const buf = await readPath(resolved)
          if (buf) {
            resumeText = (await extractText(buf)).slice(0, 6000)
            if (!resumeName) resumeName = path.basename(resolved).replace(/\.docx$/i, "")
          }
        }
      }
    } catch { /* no resume → write from the JD alone, still grounded, no fabrication */ }

    const system =
      `You write a single, ready-to-send cover letter. Output ONLY the letter body — no preamble, ` +
      `no markdown, no "[brackets]" or placeholders of any kind, no Latin/lorem filler. ` +
      `250-330 words, 3-4 short paragraphs. Tone: ${TONE_GUIDE[tone]}. ` +
      `Ground EVERY claim in the candidate's real resume below — never invent employers, metrics, or skills. ` +
      `Open with genuine interest in the specific role/company, connect the candidate's strongest relevant ` +
      `experience to the JD's top needs, and close with a confident call to talk. ` +
      `Use the candidate's real name from the resume in the sign-off if present; otherwise end with "Sincerely,".`

    const user =
      `ROLE: ${role || "(infer from JD)"}\nCOMPANY: ${company || "(infer from JD)"}\n\n` +
      `JOB DESCRIPTION:\n${jd.slice(0, 4000) || "(none provided — use the role above)"}\n\n` +
      `CANDIDATE RESUME (ground all claims here):\n${resumeText || "(no resume on file — keep claims general and honest, do not fabricate specifics)"}`

    const { text } = await callLLM({ keys, tier: "light", pref: body.llmLight, system, user, maxTokens: 900 })
    const letter = (text || "").trim()
    if (!letter) return NextResponse.json({ error: "The model returned an empty letter — try again." }, { status: 502 })

    return NextResponse.json({ letter, resumeName })
  } catch (e) {
    return NextResponse.json({ error: `Cover letter generation failed: ${String(e)}` }, { status: 500 })
  }
}
