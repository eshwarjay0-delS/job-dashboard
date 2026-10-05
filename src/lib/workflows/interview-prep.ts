import { callLLM, hasAnyKey, resolveKeys, type ProviderPref } from "@/lib/llm"
import { exactStringArrayObject, parseJsonObject } from "./structured"
import {
  failWorkflowRun,
  getWorkflowCache,
  markWorkflowAwaitingApproval,
  putWorkflowCache,
  recordWorkflowStep,
  requireActiveSubscription,
  startWorkflowRun,
} from "./runtime"

const WORKFLOW_KEY = "interview_prep_v1"

export type InterviewPrepInput = {
  company?: string
  role?: string
  interviewType?: string
  notes?: string
  llmLight?: ProviderPref
  claudeKey?: string
  openrouterKey?: string
  geminiKey?: string
  groqKey?: string
}

export type InterviewPrepOutput = {
  questions: string[]
  tips: string[]
  starPrompts: string[]
  whatToResearch: string[]
}

function normalize(input: InterviewPrepInput) {
  return {
    company: String(input.company || "the company").trim().slice(0, 180),
    role: String(input.role || "the role").trim().slice(0, 180),
    interviewType: String(input.interviewType || "video").trim().slice(0, 60),
    notes: String(input.notes || "").trim().slice(0, 4000),
  }
}

function stableKey(parts: string[]) {
  return parts.map(part => part.trim().toLowerCase()).join("||")
}

function validateOutput(value: InterviewPrepOutput): InterviewPrepOutput {
  const clean = {
    questions: value.questions.slice(0, 8),
    tips: value.tips.slice(0, 5),
    starPrompts: value.starPrompts.slice(0, 4),
    whatToResearch: value.whatToResearch.slice(0, 4),
  }

  if (clean.questions.length < 4) throw new Error("Prep output did not include enough interview questions.")
  if (clean.tips.length < 3) throw new Error("Prep output did not include enough tactical tips.")
  if (clean.starPrompts.length < 2) throw new Error("Prep output did not include enough STAR prompts.")
  if (clean.whatToResearch.length < 2) throw new Error("Prep output did not include enough research targets.")

  const placeholder = /\[(?:insert|company|role|metric|name|date|.+?you.+?)\]|\bTBD\b|\bTODO\b/i
  const all = [
    ...clean.questions,
    ...clean.tips,
    ...clean.starPrompts,
    ...clean.whatToResearch,
  ]
  if (all.some(item => placeholder.test(item))) {
    throw new Error("Prep output contained a fill-in placeholder.")
  }

  return clean
}

function promptFor(input: ReturnType<typeof normalize>) {
  const typeLabel: Record<string, string> = {
    phone: "Phone Screen",
    video: "Video Call",
    technical: "Technical Interview",
    onsite: "On-site Interview",
    final: "Final Round",
  }

  const system = [
    "ROLE",
    "You are MarketFit's interview-prep specialist.",
    "",
    "CONTEXT",
    "You receive the company, role, interview type, and optional user notes from a deterministic workflow.",
    "",
    "RULES",
    "- Be specific to the supplied company, role, and interview type.",
    "- Do not invent candidate accomplishments, metrics, employers, projects, or technologies that were not supplied.",
    "- For technical rounds, name concrete topics that logically follow from the role context, not generic filler.",
    "- STAR prompts must ask the user to recall real evidence rather than pre-filling a story.",
    "- Research targets must be explicit and actionable.",
    "- No placeholders, brackets, TODOs, or conversational filler.",
    "",
    "OUTPUT",
    "Return exactly one JSON object with exactly four array keys: questions, tips, starPrompts, whatToResearch.",
    "Each array must contain strings only.",
  ].join("\n")

  const user = [
    "Company: " + input.company,
    "Role: " + input.role,
    "Interview type: " + (typeLabel[input.interviewType] || input.interviewType),
    input.notes ? "User notes: " + input.notes : "",
  ].filter(Boolean).join("\n")

  return { system, user }
}

export async function runInterviewPrepWorkflow(args: {
  userId: string
  input: InterviewPrepInput
}) {
  const input = normalize(args.input)
  const inputFingerprint = stableKey([
    input.company,
    input.role,
    input.interviewType,
    input.notes,
  ])

  const run = await startWorkflowRun({
    userId: args.userId,
    workflowKey: WORKFLOW_KEY,
    input,
    inputFingerprint,
    sourceChannel: "web",
  })

  try {
    const gateStarted = Date.now()
    await requireActiveSubscription(args.userId)
    await recordWorkflowStep({
      run,
      key: "subscription_gate",
      index: 1,
      type: "deterministic",
      status: "succeeded",
      output: { allowed: true },
      latencyMs: Date.now() - gateStarted,
    })

    const cacheKey = stableKey([
      input.company,
      input.role,
      input.interviewType,
      input.notes,
    ])
    const cached = await getWorkflowCache<InterviewPrepOutput>({
      userId: args.userId,
      workflowKey: WORKFLOW_KEY,
      cacheKey,
      sourceFingerprint: inputFingerprint,
    })

    await recordWorkflowStep({
      run,
      key: "cache_lookup",
      index: 2,
      type: "cache",
      status: "succeeded",
      output: { hit: Boolean(cached) },
    })

    if (cached) {
      const output = validateOutput(cached)
      await markWorkflowAwaitingApproval(run, output, { cacheHit: true })
      return { output, runId: run.id, cacheHit: true, provider: null, model: null }
    }

    const keys = resolveKeys(args.input)
    if (!hasAnyKey(keys)) throw new Error("No AI provider is configured for interview prep.")

    const prompt = promptFor(input)
    const llmStarted = Date.now()
    const result = await callLLM({
      keys,
      tier: "light",
      pref: args.input.llmLight,
      system: prompt.system,
      user: prompt.user,
      maxTokens: 1000,
      temperature: 0.2,
    })

    const parsed = exactStringArrayObject(
      parseJsonObject(result.text),
      ["questions", "tips", "starPrompts", "whatToResearch"] as const,
    )
    const output = validateOutput(parsed)

    await recordWorkflowStep({
      run,
      key: "generate_structured_prep",
      index: 3,
      type: "llm",
      status: "succeeded",
      output: {
        provider: result.provider,
        model: result.model,
        questionCount: output.questions.length,
      },
      latencyMs: Date.now() - llmStarted,
    })

    await putWorkflowCache({
      userId: args.userId,
      workflowKey: WORKFLOW_KEY,
      cacheKey,
      sourceFingerprint: inputFingerprint,
      payload: output,
    })

    await recordWorkflowStep({
      run,
      key: "cache_store",
      index: 4,
      type: "cache",
      status: "succeeded",
      output: { stored: true },
    })

    await markWorkflowAwaitingApproval(
      run,
      output,
      { provider: result.provider, model: result.model, cacheHit: false },
    )

    return {
      output,
      runId: run.id,
      cacheHit: false,
      provider: result.provider,
      model: result.model,
    }
  } catch (error) {
    await failWorkflowRun(run, "workflow_failed", error instanceof Error ? error.message : String(error))
    throw error
  }
}
