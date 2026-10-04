export type SpeakerRole = "interviewer" | "candidate" | "unknown"

export type TranscriptTurn = {
  id: string
  speakerId: string
  role: SpeakerRole
  text: string
  startedAtMs: number
  endedAtMs: number
  confidence: number
}

export type SessionMode = "auto-answer" | "tap-to-answer"

export type NativeSessionState = {
  mode: SessionMode
  roleMap: Record<string, SpeakerRole>
  turns: TranscriptTurn[]
  currentQuestion: string | null
  currentAnswer: string | null
  roleConfidence: number
  awaitingRoleConfirmation: boolean
}

export type RoleObservation = {
  speakerId: string
  text: string
  confidence: number
  startedAtMs: number
  endedAtMs: number
}
