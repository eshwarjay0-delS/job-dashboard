export class StructuredOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StructuredOutputError"
  }
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const clean = String(text || "")
    .replace(/^\s*\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .trim()

  try {
    const value = JSON.parse(clean)
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new StructuredOutputError("Structured output must be a JSON object.")
    }
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof StructuredOutputError) throw error
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new StructuredOutputError("Model returned non-JSON output.")

    try {
      const value = JSON.parse(match[0])
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new StructuredOutputError("Structured output must be a JSON object.")
      }
      return value as Record<string, unknown>
    } catch {
      throw new StructuredOutputError("Model returned invalid JSON.")
    }
  }
}

export function exactStringObject<T extends readonly string[]>(
  value: Record<string, unknown>,
  keys: T,
): Record<T[number], string> {
  const expected = new Set<string>(keys)
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new StructuredOutputError("Unexpected structured-output key: " + key)
    }
  }

  const out = {} as Record<T[number], string>
  for (const key of keys) {
    const raw = value[key]
    if (typeof raw !== "string" || !raw.trim()) {
      throw new StructuredOutputError("Structured-output key " + key + " must be a non-empty string.")
    }
    out[key as T[number]] = raw.trim()
  }
  return out
}

export function exactStringArrayObject<T extends readonly string[]>(
  value: Record<string, unknown>,
  keys: T,
): Record<T[number], string[]> {
  const expected = new Set<string>(keys)
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new StructuredOutputError("Unexpected structured-output key: " + key)
    }
  }

  const out = {} as Record<T[number], string[]>
  for (const key of keys) {
    const raw = value[key]
    if (!Array.isArray(raw)) {
      throw new StructuredOutputError("Structured-output key " + key + " must be an array.")
    }
    const items = raw
      .filter((item): item is string => typeof item === "string")
      .map(item => item.trim())
      .filter(Boolean)

    if (items.length !== raw.length) {
      throw new StructuredOutputError("Structured-output key " + key + " must contain strings only.")
    }
    out[key as T[number]] = items
  }
  return out
}
