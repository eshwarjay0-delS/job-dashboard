const SESSION_FEATURES = new Set([
  "kompas:answer", "kompas:answer-derive", "kompas:prep", "kompas:humanize",
  "kompas:screen", "kompas:persona", "kompas:guide", "kompas:questions", "kompas:section",
])

export function isSessionGeneration(purpose: string): boolean {
  return SESSION_FEATURES.has(purpose)
}

export function sessionProviderAllowed(purpose: string, provider: string, model: string): boolean {
  if (!isSessionGeneration(purpose)) return true
  // Live answer/prep work must not silently fall back to free allowances.
  // Voice recognition has its own configured provider and billing policy.
  return ["openrouter", "openai", "anthropic"].includes(provider) && !/:free$/i.test(model) && model !== "openrouter/free"
}
