// Client-side helper for calling /api/jobs. Attaches the user's own RapidAPI /
// USAJobs keys (Settings → saved in localStorage under "jd_settings", same
// pattern as the existing Claude key) as request headers, so live job data
// works from a plain Settings form — no .env.local editing required.
export function jobsFetchHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("jd_settings")
    if (!raw) return {}
    const s = JSON.parse(raw)
    const h: Record<string, string> = {}
    if (s.rapidApiKey) h["x-rapid-api-key"] = s.rapidApiKey
    if (s.usajobsApiKey) h["x-usajobs-api-key"] = s.usajobsApiKey
    return h
  } catch { return {} }
}

export function fetchJobs(pathAndQuery: string): Promise<Response> {
  return fetch(pathAndQuery, { headers: jobsFetchHeaders() })
}
