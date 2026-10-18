"use client"
import { useState } from "react"

const MIGRATION_SQL = `-- Crawl jobs: centralized contract-job listings spidered from prime vendor portals.
-- Run in the Mfit project's SQL editor (us-east-1). Shared/global data (no user_id):
-- reads are public to signed-in app users; writes go through the service role only.

create table if not exists public.mfit_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  portal text not null,
  firm text not null,
  title text not null,
  location text,
  work_type text not null default 'unknown',
  engagement text,
  pay_range text,
  posted_at date,
  url text not null,
  description text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  unique (portal, url)
);
create index if not exists mfit_crawl_jobs_active_idx on public.mfit_crawl_jobs (active, work_type);
create index if not exists mfit_crawl_jobs_search_idx on public.mfit_crawl_jobs
  using gin (to_tsvector('english', title || ' ' || coalesce(location, '') || ' ' || coalesce(description, '')));

create table if not exists public.mfit_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  portals text[] not null default '{}',
  jobs_found int not null default 0,
  jobs_upserted int not null default 0,
  errors jsonb not null default '[]'::jsonb
);

alter table public.mfit_crawl_jobs enable row level security;
alter table public.mfit_crawl_runs enable row level security;

drop policy if exists "crawl jobs readable" on public.mfit_crawl_jobs;
create policy "crawl jobs readable" on public.mfit_crawl_jobs
  for select to authenticated using (true);

drop policy if exists "crawl runs readable" on public.mfit_crawl_runs;
create policy "crawl runs readable" on public.mfit_crawl_runs
  for select to authenticated using (true);`

export default function CrawlerSetupPage() {
  const [status, setStatus] = useState<"unknown" | "missing" | "ready" | "checking">("unknown")
  const [copied, setCopied] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState("")
  const [jobCount, setJobCount] = useState<number | null>(null)

  async function check() {
    setStatus("checking")
    try {
      const r = await fetch("/api/crawl/jobs?limit=1", { cache: "no-store" })
      const j = await r.json()
      if (j.ok) {
        setStatus("ready")
        setJobCount(j.jobs?.length ?? 0)
      } else if (String(j.reason || "").includes("Could not find the table")) {
        setStatus("missing")
      } else {
        setStatus("missing")
      }
    } catch {
      setStatus("missing")
    }
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the text
      const el = document.getElementById("crawl-sql")
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  async function runCrawl() {
    setCrawling(true)
    setCrawlResult("")
    try {
      const r = await fetch("/api/crawl/jobs", { method: "POST" })
      const j = await r.json()
      if (j.ok) {
        setCrawlResult(`Crawled ${j.jobs_found || 0} jobs, upserted ${j.jobs_upserted || 0}.`)
        void check()
      } else {
        setCrawlResult(`Crawl failed: ${j.error || j.reason || "unknown"}`)
      }
    } catch (e) {
      setCrawlResult(`Crawl failed: ${e instanceof Error ? e.message : "network error"}`)
    } finally {
      setCrawling(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 64px" }}>
      <p style={{ fontSize: 11, letterSpacing: 2, fontWeight: 800, color: "var(--text-muted)" }}>MARKETFIT · ADMIN</p>
      <h1 style={{ fontSize: 28, letterSpacing: -0.5, margin: "8px 0" }}>Job crawler setup</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
        The crawler is our own job index — the real product, replacing the temporary Jobright bridge.
        It needs two tables in your Supabase. One SQL run, then you're live.
      </p>

      <button onClick={check} disabled={status === "checking"} className="btn-primary" style={{ margin: "16px 0" }}>
        {status === "checking" ? "Checking…" : "Check table status"}
      </button>

      {status === "ready" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 20, background: "var(--surface)", marginTop: 12 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--text)" }}>✅ Tables are live</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
            {jobCount !== null ? `${jobCount} jobs in the index.` : "The crawler index is ready."} Run the first crawl to fill it.
          </p>
          <button onClick={runCrawl} disabled={crawling} className="btn-primary">
            {crawling ? "Crawling…" : "Run first crawl"}
          </button>
          {crawlResult && <p style={{ fontSize: 13.5, marginTop: 12, color: "var(--text)" }}>{crawlResult}</p>}
        </div>
      )}

      {status === "missing" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 20, background: "var(--surface)", marginTop: 12 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 8px", color: "var(--text)" }}>Tables not found</h2>
          <ol style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)", paddingLeft: 20, margin: "0 0 16px" }}>
            <li>Open your <strong>Mfit</strong> Supabase project (us-east-1) → SQL Editor</li>
            <li>Copy the SQL below and run it</li>
            <li>Come back here and hit "Check table status"</li>
          </ol>
          <button onClick={copySql} className="btn-ghost" style={{ marginBottom: 12 }}>
            {copied ? "✓ Copied!" : "Copy SQL"}
          </button>
          <pre id="crawl-sql" style={{
            fontSize: 11.5, lineHeight: 1.5, background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 14, overflow: "auto", maxHeight: 320, whiteSpace: "pre-wrap",
            color: "var(--text)", userSelect: "all",
          }}>{MIGRATION_SQL}</pre>
        </div>
      )}

      {status === "unknown" && (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Hit "Check table status" to see if the crawler tables exist.</p>
      )}
    </main>
  )
}
