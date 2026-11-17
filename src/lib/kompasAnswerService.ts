import { figureList } from "@/lib/kompasFigureContext"
import { filterPreparedQuestionContext } from "@/lib/kompasQuestionKey"
import { deriveWithFallback } from "@/lib/kompasDeriveFallback"
import { NextRequest, NextResponse } from "next/server"
import { keysFor, resolveKeys, type LlmKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { employerAliases } from "@/lib/kompasResume"
import { cachedDigest, sessionFacts } from "@/lib/kompasSessionCache"
import { createSentenceGate, sentenceCheck, sourcedOpenerFor, splitOpenerPassages, withOpener, type SourcedOpener } from "@/lib/kompasSentenceGate"
import { hashUserId } from "@/lib/sttLedger"
import { scheduleLlmRecord } from "@/lib/llmLedger"
import {
  classify, canonicalQuestion, requestedParts, cutShort, lengthPlan, questionDepth, deriveByCode, questionForAnswer, DIRECTOR_OPENING,
  tierRule, pickShape, DERIVE_SYSTEM, INTRODUCTION_POLICY, INTRO_CAREER_SPINE, INTENT_BOUNDARY, PERSONAL_EXPERIENCE_POLICY, TECHNICAL_ANSWER_BOUNDARY, RESPONSE_CRAFT_POLICY, isPersonalEvidenceQuestion, type LengthPlan,
  answerLevel, questionRegister, levelGuidance, ANSWER_LEVEL_NAME, missingStructure, structureRepairSystem,
  normLedger, toLedgerProjects, pickProject, pickBottleneck, pickAngle,
  commit, recordAngle, matchBank, differentQuestionLine,
} from "@/lib/kompasAnswer"
import { QUESTION_FIRST_POLICY, repeatQuestionGuidance } from "@/lib/kompasIntent"
import { voiceR¶»§q«^