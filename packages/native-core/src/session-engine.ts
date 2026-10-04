import type {
  NativeSessionState,
  RoleObservation,
  SpeakerRole,
  TranscriptTurn,
} from "./types"

const QUESTION_HINT = /\?|^(why|what|when|where|who|how|tell me|walk me|describe|explain|can you|could you|have you|do you|did you|are you|would you)\b/i
const ANSWER_HINT = /^(i |i'm|i’ve|i have|my |we |in my|at my|during my|one example)/i

function inferRole(text: string): SpeakerRole {
  const normalized = text.trim()
  if (!normalized) return "unknown"
  if (QUESTION_HINT.test(normalized)) return "interviewer"
  if (ANSWER_HINT.test(normalized)) return "candidate"
  return "unknown"
}

export class NativeInterviewSessionEngine {
  private state: NativeSessionState = {
    mode: "auto-answer",
    roleMap: {},
    turns: [],
    currentQuestion: null,
    currentAnswer: null,
    roleConfidence: 0,
    awaitingRoleConfirmation: false,
  }

  snapshot(): NativeSessionState {
    return {
      ...this.state,
      roleMap: { ...this.state.roleMap },
      turns: [...this.state.turns],
    }
  }

  setAutoAnswer(enabled: boolean) {
    this.state.mode = enabled ? "auto-answer" : "tap-to-answer"
  }

  confirmSpeakerRole(speakerId: string, role: Exclude<SpeakerRole, "unknown">) {
    this.state.roleMap[speakerId] = role
    this.state.roleConfidence = 1
    this.state.awaitingRoleConfirmation = false
  }

  ingest(observation: RoleObservation): {
    turn: TranscriptTurn
    shouldGenerateAnswer: boolean
    question: string | null
  } {
    const heuristic = inferRole(observation.text)
    const existing = this.state.roleMap[observation.speakerId]
    const role = existing ?? heuristic

    if (!existing && role !== "unknown" && observation.confidence >= 0.72) {
      this.state.roleMap[observation.speakerId] = role

      const otherSpeaker = Object.keys(this.state.roleMap).find(id => id !== observation.speakerId)
      if (otherSpeaker && this.state.roleMap[otherSpeaker] === "unknown") {
        this.state.roleMap[otherSpeaker] = role === "interviewer" ? "candidate" : "interviewer"
      }
    }

    const knownRoles = Object.values(this.state.roleMap).filter(r => r !== "unknown")
    this.state.roleConfidence = knownRoles.length >= 2 ? 0.94 : knownRoles.length === 1 ? 0.76 : 0.3
    this.state.awaitingRoleConfirmation = this.state.roleConfidence < 0.65

    const turn: TranscriptTurn = {
      id: crypto.randomUUID(),
      speakerId: observation.speakerId,
      role,
      text: observation.text.trim(),
      startedAtMs: observation.startedAtMs,
      endedAtMs: observation.endedAtMs,
      confidence: observation.confidence,
    }
    this.state.turns.push(turn)

    const isInterviewerQuestion =
      role === "interviewer" &&
      observation.confidence >= 0.65 &&
      QUESTION_HINT.test(observation.text.trim())

    if (isInterviewerQuestion) {
      this.state.currentQuestion = observation.text.trim()
      this.state.currentAnswer = null
    }

    return {
      turn,
      shouldGenerateAnswer: Boolean(isInterviewerQuestion && this.state.mode === "auto-answer"),
      question: isInterviewerQuestion ? observation.text.trim() : null,
    }
  }

  setGeneratedAnswer(answer: string) {
    this.state.currentAnswer = answer
  }
}
