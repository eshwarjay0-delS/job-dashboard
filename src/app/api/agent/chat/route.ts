import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt"
import { runTool, toolPromptBlock } from "../_tools"
import { checkRateLimit } from "@/lib/rateLimit"
import { plainFailure, failureKind, failureTag, worthAnotherTry } from "@/lib/plain-failure"
import { isAdminEmail } from "@/lib/owner"

export const runtime = "nodejs"
export const maxDuration = 60

// 100 agent messages per day per user.
const AGENT_DAILY_LIMIT = Number(process.env.AGENT_DAILY_LIMIT ?? 100)
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_TOOL_ROUNDS = 6

interface ChatMsg { role: "user" | "assistant"; content: string }

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/chat — MFit Agent chat with tool loop
// Body: { messages: [{role, content}] }
// Returns: { reply }
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_BLOCK_RE = /```tool\s*\n([\s\S]*?)\n```/

// A tool that fails hands back its own error text (a status code, a service's words). That is for the agent to read,
// not for the person: the reply says what could not be done, in a sentence, and what to do next.
const WHEN_A_TOOL_FAILS = "WHEN A TOOL FAILS: tell him in one plain sentence what you could not do and what he can do next. Never repeat the error text, a status code, a service's name for its own fault, or the words TOOL RESULT. Then carry on with whatever the other results allow."

export async function POST(req: NextRequest) {
  // Set once a tool has run, so a failure after it does not say "nothing was changed".
  let acted = false
  // The owner of the site is also told which service answered with which status (two words, none of the service's text).
  let owner = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    owner = !!user.email_confirmed_at && isAdminEmail(user.email)

    const body = await req.json().catch(() => ({}))
    const messages: ChatMsg[] = body.messages || []
    const lastUser = [...messages].reverse().find(m => m.role === "user")
    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ error: "No message provided." }, { status: 400 })
    }

    const rl = checkRateLimit(`agent:${user.id}`, { max: AGENT_DAILY_LIMIT, windowMs: DAY_MS })
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Daily agent limit reached (${AGENT_DAILY_LIMIT} messages/day). Try again tomorrow.` },
        { status: 429 },
      )
    }

    const keys = resolveKeys({})
    if (!hasAnyKey(keys)) {
      return NextResponse.json(
        { error: "The agent has no AI key configured yet. The app owner needs to add one in Settings." },
        { status: 503 },
      )
    }

    const system = `${AGENT_SYSTEM_PROMPT}\n\n${toolPromptBlock()}\n\n${WHEN_A_TOOL_FAILS}`
    const convo: ChatMsg[] = messages.slice(-12) // keep the turn bounded
    const ctx = { userId: user.id }

    // One more try, once in a message, when the services refused for a reason that clears by itself in a moment. Seen on
    // 13 Oct 2026: "updates" failed in 1.2 seconds, and the same message nine seconds later was answered.
    let retried = false
    const ask = async () => {
      const call = () => callLLM({ keys, tier: "heavy", purpose: "agent", system, messages: convo, maxTokens: 1500 })
      try { return await call() } catch (first) {
        if (retried || !worthAnotherTry(first)) throw first
        retried = true
        console.error("agent/chat: asking once more after", failureTag(first) || failureKind(first))
        await new Promise(r => setTimeout(r, 1500))
        return call()
      }
    }

    let reply = ""
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await ask()
      const text = res.text || ""
      const m = text.match(TOOL_BLOCK_RE)

      if (!m) {
        reply = text.replace(TOOL_BLOCK_RE, "").trim()
        break
      }

      // Execute the tool call, feed the result back, and let the model continue.
      let toolName = ""
      let toolArgs: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(m[1].trim()) as { tool?: string; args?: Record<string, unknown> }
        toolName = String(parsed.tool || "")
        toolArgs = parsed.args || {}
      } catch {
        convo.push({ role: "assistant", content: text })
        convo.push({ role: "user", content: `[TOOL RESULT] tool=parse args={} → {"ok": false, "error": "That tool block was not valid JSON. Try again with exact JSON."}` })
        continue
      }

      const result = await runTool(ctx, toolName, toolArgs)
      acted = true
      convo.push({ role: "assistant", content: text })
      convo.push({
        role: "user",
        content: `[TOOL RESULT] tool=${toolName} → ${JSON.stringify(result).slice(0, 6000)}`,
      })
      reply = "" // a tool call means the answer isn't final yet
    }

    if (!reply) {
      reply = "I could not put that together this time. Ask again, or ask for one thing at a time."
    }

    return NextResponse.json({ ok: true, reply })
  } catch (err) {
    // The whole of it goes to the server log. The person is told the reason in one plain sentence and nothing else:
    // not which service, not its status code, not its own words (owner, 13 Oct 2026: "We should not show any failpoints").
    console.error("agent/chat error:", failureTag(err), err)
    const tag = owner ? failureTag(err) : ""
    return NextResponse.json({ error: plainFailure(err, "answer", acted) + (tag ? ` (${tag})` : ""), reason: failureKind(err) }, { status: 500 })
  }
}
