import { callLLM, hasAnyKey, resolveKeys, type ProviderPref } from "@/lib/llm"
import { exactStringObject, parseJsonObject } from "./structured"
import {
  createWorkflowApproval,
  failWorkflowRun,
  getWorkflowCache,
  markWorkflowAwaitingApproval,
  putWorkflowCache,
  recordWorkflowStep,
  requireActiveSubscription,
  startWorkflowRun,
} from "./runtime"

const WORKFLOW_KEY = "poke_followup_v1"
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
const PLACEHOLDER_RE = /\\[(?:insert|name|company|role|date|metric|number|anything|.+?you.+?)\\]|\\bTBD\\b|\\bTODO\\b|<[^>]{1,50}>/i

export type PokeDraftInput = {
  recipient: string
  recipientName?: string
  company?: string
  role?: string
  context?: string
  accountId?: string | null
  includeResume?: boolean
  llmLight?: ProviderPref
  claudeKey?: string
  openrouterKey?: string
  geminiKey?: string
  groqKey?: string
}

export type PokeDraft = {
  subject: string
  body: string
}

function stableKey(parts: Array<string | boolean | null>) {
  return parts.map(part => String(part ?? "")).join("||")
}

function normalize(input: PokeDraftInput) {
  const recipient = String(input.recipient || "").trim().toLowerCase()
  if (!EMAIL_RE.test(recipient)) throw new Error("Enter a valid recruiter email address.")

  const normalized = {
    recipient,
    recipientName: String(input.recipientName || "").trim().slice(0, 120),
    company: String(input.company || "").trim().slice(0, 180),
    role: String(input.role || "").trim().slice(0, 180),
    context: String(input.context || "").trim().slice(0, 4000),
    accountId: input.accountId ? String(input.accountId) : null,
    includeResume: Boolean(input.includeResume),
  }

  if (!normalized.company && !normalized.role && !normalized.context) {
    throw new Error("Add a company, role, or short context before generating the follow-up.")
  }

  return normalized
}

function validateDraft(draft: PokeDraft, source: ReturnType<typeof normalize>) {
  if (draft.subject.length > 140) throw new Error("Draft subject is too long.")
  if (draft.body.length < 35 || draft.body.length > 1800) {
    throw new Error("Draft body length is outside the allowed range.")
  }
  if (PLACEHOLDER_RE.test(draft.subject) || PLACEHOLDER_RE.test(draft.body)) {
    throw new Error("Draft contains a fill-in placeholder.")
  }
  if (!source.includeResume && /\\b(attached|attachment|attached my resume|resume attached)\\b/i.test(draft.body)) {
    throw new Error("Draft claims a resume is attached when no attachment was requested.")
  }

  const sourceText = [
    source.company,
    source.role,
    source.context,
    source.recipientName,
  ].join(" ")
  const allowedNumbers = new Set(sourceText.match(/\\b\\d+(?:\\.\\d+)?%?\\b/g) || [])
  const generatedNumbers = draft.body.match(/\\b\\d+(?:\\.\\d+)?%?\\b/g) || []
  const unsupported = generatedNumbers.filter(value => !allowedNumbers.has(value))
  if (unsupported.length) {
    throw new Error("Draft introduced unsupported numeric detail: " + unsupported[0])
  }

  return draft
}

function promptFor(source: ReturnType<typeof normalize>) {
  const context = [
    source.company ? "Company: " + source.company : "",
    source.role ? "Role: " + source.role : "",
    source.recipientName ? "Recipient name: " + source.recipientName : "",
    source.context ? "Known context: " + source.context : "",
    "Resume attachment requested: " + (source.includeResume ? "yes" : "no"),
  ].filter(Boolean).join("\\n")

  const system = [
    "ROLE",
    "You draft concise recruiter follow-up emails for MarketFit.",
    "",
    "CONTEXT",
    "You receive only facts supplied by the user below. Treat them as the complete factual boundary.",
    "",
    "RULES",
    "- Never invent dates, metrics, interviews, offers, prior conversations, company facts, or candidate history.",
    "- Never emit brackets, blanks, placeholders, TODOs, or instructions for the user to fill in.",
    "- Keep the email natural, professional, direct, and approximately 70-140 words.",
    "- Use the recipient name only when it was supplied.",
    "- Mention an attached resume only when Resume attachment requested is yes.",
    "- Do not add conversational commentary before or after the requested object.",
    "",
    "OUTPUT",
    "Return exactly one JSON object with exactly two string keys: subject and body.",
    "",
    "EXAMPLE",
    "Input facts: Company: Acme; Role: Security Engineer; Known context: I applied last week.",
    "Correct output shape: {\\"subject\\":\\"Following up on the Security Engineer role\\",\\"body\\":\\"Hi,\\n\\nI wanted to follow up on my application for the Security Engineer role at Acme. I remain interested in the opportunity and would be glad to provide any additional information that would be helpful.\\n\\nBest,\\nEshwar\\"}",
  ].join("\\n")

  return { system, user: context }
}

export async function runPokeDraftWorkflow(args: {
  userId: string
  input: PokeDraftInput
}) {
  const source = normalize(args.input)
  const inputFingerprint = stableKey([
    source.recipient,
    source.recipientName,
    source.company,
    source.role,
    source.context,
    source.accountId,
    source.includeResume,
  ])

  const run = await startWorkflowRun({
    userId: args.userId,
    workflowKey: WORKFLOW_KEY,
    input: source,
    inputFingerprint,
    sourceChannel: "web",
  })

  const started = Date.now()

  try {
    await requireActiveSubscription(args.userId)
    await recordWorkflowStep({
      run,
      key: "subscription_gate",
      index: 1,
      type: "deterministic",
      status: "succeeded",
      output: { allowed: true },
      latencyMs: Date.now() - started,
    })

    const cacheKey = stableKey([
      source.recipient,
      source.company,
      source.role,
      source.context,
      source.includeResume,
    ])

    const cached = await getWorkflowCache<PokeDraft>({
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

    let draft: PokeDraft
    let provider: string | undefined
    let model: string | undefined
    let cacheHit = false

    if (cached) {
      draft = validateDraft(cached, source)
      cacheHit = true
    } else {
      const keys = resolveKeys(args.input)
      if (!hasAnyKey(keys)) {
        throw new Error("No AI provider is configured for follow-up drafting.")
      }

      const prompt = promptFor(source)
      const llmStarted = Date.now()
      const result = await callLLM({
        keys,
        tier: "light",
        pref: args.input.llmLight,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 500,
        temperature: 0.2,
      })

      const parsed = exactStringObject(parseJsonObject(result.text), ["subject", "body"] as const)
      draft = validateDraft(parsed, source)
      provider = result.provider
      model = result.model

      await recordWorkflowStep({
        run,
        key: "draft_with_llm",
        index: 3,
        type: "llm",
        status: "succeeded",
        output: { provider, model },
        latencyMs: Date.now() - llmStarted,
      })

      await putWorkflowCache({
        userId: args.userId,
        workflowKey: WORKFLOW_KEY,
        cacheKey,
        sourceFingerprint: inputFingerprint,
        payload: draft,
      })

      await recordWorkflowStep({
        run,
        key: "cache_store",
        index: 4,
        type: "cache",
        status: "succeeded",
        output: { stored: true },
      })
    }

    const approvalPayload = {
      accountId: source.accountId,
      to: source.recipient,
      subject: draft.subject,
      body: draft.body,
    }
    const approvalFingerprint = stableKey([
      source.accountId,
      source.recipient,
      draft.subject,
      draft.body,
    ])

    const approval = await createWorkflowApproval({
      run,
      actionKey: "gmail_send",
      payload: approvalPayload,
      payloadFingerprint: approvalFingerprint,
    })

    await recordWorkflowStep({
      run,
      key: "human_approval",
      index: 5,
      type: "approval",
      status: "succeeded",
      output: { approvalId: approval.id },
    })

    await markWorkflowAwaitingApproval(
      run,
      {
        draft,
        approvalId: approval.id,
        approvalFingerprint: approval.payloadFingerprint,
      },
      { provider, model, cacheHit },
    )

    return {
      runId: run.id,
      workflow: WORKFLOW_KEY,
      draft,
      approvalId: approval.id,
      approvalFingerprint: approval.payloadFingerprint,
      cacheHit,
      provider: provider ?? null,
      model: model ?? null,
    }
  } catch (error) {
    await failWorkflowRun(
      run,
      "workflow_failed",
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }
}
