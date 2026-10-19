# MarketFit MCP Surface Design

**Status:** Design (2026-10-18)
**REA source:** Tsenta's production MCP server (`docs/research/tsenta-recon.md`)
**Principle:** MCP as first-class surface, not integration afterthought. One backend, many surfaces.

## Why

Tsenta ships `https://api.autojobs.me/api/v1/mcp` as a production surface — "apply from inside your AI chat" is core, not an integration. Their MCP is the **same backend** as the web dashboard. We follow the same pattern: our existing `/api/*` routes become MCP tools.

## Endpoint

```
https://job-dashboard-fawn.vercel.app/api/mcp
```

Transport: Streamable HTTP (same as Tsenta — works with Claude Code, Desktop, Cursor, ChatGPT).

## Auth: OAuth 2.1 (Tsenta pattern)

| Item | Our value |
|---|---|
| Protected resource | `https://job-dashboard-fawn.vercel.app/api/mcp` |
| Authorization server | `https://job-dashboard-fawn.vercel.app` |
| Authorize | `/oauth/authorize` |
| Token | `/oauth/token` |
| Dynamic client registration | `/oauth/register` |
| Revocation | `/oauth/revoke` |

Discovery via `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` (same as Tsenta — probed live 200 OK on their side).

Scopes map to our existing Supabase auth:
- `jobs:read` — search jobs via `/api/jobs`
- `resume:write` — tailor via `/api/resumes`
- `apply:read` — pipeline via `/api/apply/activity`
- `gmail:read` — digest via mail API (user-consented)

## Tools (v1)

| Tool | Maps to | Description |
|---|---|---|
| `search_jobs` | `GET /api/jobs` | Search 9 aggregated sources (JSearch, Jobright, Greenhouse, Ashby, RemoteOK, etc.) |
| `tailor_resume` | `POST /api/resumes/tailor` | Tailor resume to JD, returns coverage % |
| `get_match_score` | `POST /api/apply/match` | Keyword match % for job + resume |
| `list_applications` | `GET /api/apply/activity` | Pipeline: saved → submitted |
| `get_portal` | 57-firm directory | Portal URL + ATS platform + automationPath |

## Tools (v2 — needs blockers cleared)

| Tool | Depends on |
|---|---|
| `start_crawl` | crawl-schema migration (user SQL) |
| `autofill_form` | headless renderer pick (Vercel vs VM) |
| `submit_application` | review gate + user approval |

## Non-goals

- We do NOT expose raw Gmail send. Every outbound email stays a draft for user approval (standing rule).
- We do NOT expose PII fields (DOB, SSN, passport) — never stored, never via MCP.

## Implementation notes

- MCP tools are thin wrappers over existing `/api/*` routes — no new business logic.
- Auth reuses Supabase JWT (same as web). OAuth 2.1 is the MCP-standard wrapper.
- Rate limits: same as web API (per-user, not per-surface).

## Next

1. Scaffold `/api/mcp` route with Streamable HTTP transport
2. Implement `/.well-known/oauth-*` discovery endpoints
3. Wire v1 tools to existing routes
4. Register in REA admin section as 13th session
