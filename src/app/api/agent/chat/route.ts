import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callLLM, resolveKeys, hasAnyKey } from "@/lib/llm"
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt"
import { runTool, toolPromptBlock } from "../_tools"
import { checkRateLimit } from "@/lib/rateLimit"

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

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

    const system = `${AGENT_SYSTEM_PROMPT}\n\n${toolPromptBlock()}`
    const convo: ChatMsg[] = messages.slice(-12) // keep the turn bounded
    const ctx = { userId: user.id }

    let reply = ""
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await callLLM({
        keys,
        tier: "heavy",
        purpose: "agent",
        system,
        messages: convo,
        maxTokens: 1500,
      })
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
      convo.push({ role: "assistant", content: text })
      convo.push({
        role: "user",
        content: `[TOOL RESULT] tool=${toolName} → ${JSON.stringify(result).slice(0, 6000)}`,
      })
      reply = "" // a tool call means the answer isn't final yet
    }

    if (!reply) {
      reply = "I ran into trouble pulling that together — try asking again in a simpler way."
    }

    return NextResponse.json({ ok: true, reply })
  } catch (err) {
    console.error("agent/chat error:", err)
    return NextResponse.json({ error: "The agent hit an error. Try again." }, { status: 500 })
  }
}
