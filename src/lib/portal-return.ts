export type PortalJob = { id: string; title: string; company: string; location: string; url: string; source: string }
export type PortalReturn = { job: PortalJob; query: string; resume: string; at: number }

/** Capture only the posting identity and selected context, never its full JD. */
export function portalSnapshot(job: PortalJob, query: string, resume: string, at = Date.now()): PortalReturn {
  const { id, title, company, location, url, source } = job
  return { job: { id, title, company, location, url, source }, query, resume, at }
}

export function readPortalReturn(raw: string | null, now = Date.now()): PortalReturn | null {
  try {
    const value = JSON.parse(raw || 'null')
    if (!value || !Number.isFinite(value.at) || value.at > now || now - value.at >= 3600000) return null
    if (!value.job || !['id', 'title', 'company', 'location', 'url', 'source'].every(key => typeof value.job[key] === 'string')) return null
    if (!value.job.id || !value.job.title || typeof value.query !== 'string' || typeof value.resume !== 'string') return null
    const url = new URL(value.job.url)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return portalSnapshot(value.job, value.query, value.resume, value.at)
  } catch { return null }
}
