# Jobright.ai API Reconnaissance Report

**Date:** 2026-10-17
**Method:** REA (Reverse Engineer Anything) + manual static analysis
**Status:** ✅ Working queryable endpoint found

---

## Executive Summary

Jobright.ai does **not** expose a public REST API (`/api/*` → 404). However, their Next.js data hydration endpoint is publicly accessible and returns real job listings as JSON — no authentication required.

**Working endpoint:**
```
https://jobright.ai/_next/data/{buildId}/jobs/{slug}.json
```

---

## The Endpoint

### URL Pattern
```
https://jobright.ai/_next/data/MR4rnvx8Ie8JpVOzMpk-d/jobs/cybersecurity-contract.json
```

| Component | Description |
|-----------|-------------|
| `buildId` | Next.js build identifier. Currently `MR4rnvx8Ie8JpVOzMpk-d`. **Fetch dynamically** from homepage HTML (`"buildId":"..."`) as it changes on redeploy. |
| `slug` | Search keywords, hyphen-separated. Influences results. |

### Working curl Example
```bash
# Get the current buildId first (it changes on redeploy)
BUILD_ID=$(curl -s "https://jobright.ai/" -A "Mozilla/5.0" | grep -o '"buildId":"[^"]*"' | cut -d'"' -f4)

# Fetch cybersecurity contract jobs
curl -s "https://jobright.ai/_next/data/${BUILD_ID}/jobs/cybersecurity-contract.json" \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
pp = d['pageProps']
print(f\"Total: {pp['totalJobs']} jobs\")
for job in pp['jobList']:
    jr = job['jobResult']
    co = job.get('companyResult', {})
    print(f\"- {jr['jobTitle']} @ {co.get('companyName')} | {jr['jobLocation']} | {jr['employmentType']} | {jr['publishTimeDesc']}\")
"
```

### Slug Examples (tested)
| Slug | Total Jobs | Notes |
|------|-----------|-------|
| `cybersecurity` | 7,500 | General cybersecurity search |
| `cybersecurity-contract` | 2,191 | Includes Contract + Full-time/Contract roles |
| `cybersecurity-jobs-in-texas` | 2,254 | Location in slug (not parsed as filter, but influences results) |

---

## Response Schema

### Top Level
```json
{
  "pageProps": {
    "jobList": [...],       // Array of 16 job objects (sample)
    "totalJobs": 2191,      // Total matching jobs in their index
    "query": {...},         // Parsed query info
    "apiMode": "seo-new",   // API mode identifier
    "jobKeywords": [...],
    "seoContext": {...}
  },
  "__N_SSP": true            // Next.js SSP marker
}
```

### Job Object (`pageProps.jobList[]`)
```json
{
  "impId": "0_search_1792280595683_3150",
  "jobResult": {
    "jobId": "6a75ec3267a1ad0bc53c7cc2",
    "jobTitle": "Junior Cybersecurity Project Manager (Contract to Hire)",
    "jobNlpTitle": "Junior Cybersecurity Project Manager",
    "jobSeniority": "Mid Level",
    "jobLocation": "Columbus, OH",
    "jobLocations": ["Columbus, OH"],
    "isRemote": false,
    "workModel": "Hybrid",
    "publishTime": "2026-08-08 17:44:47",
    "publishTimeDesc": "2 months ago",
    "employmentType": "Full-time, Contract",
    "jobSummary": "Blue Star Partners is seeking...",
    "applicantsCount": 25,
    "minYearsOfExperience": 2,
    "coreResponsibilities": [...],
    "requirements": [...],
    "recommendationTags": [...],
    "jobTags": [...],
    "url": "https://jobright.ai/jobs/info/6a75ec3267a1ad0bc53c7cc2?utm_source=1014",
    "applyLink": "https://jobright.ai/jobs/info/6a75ec3267a1ad0bc53c7cc2?utm_source=1014",
    "h1BStatus": "...",
    "lat": 39.96,
    "lng": -82.99,
    "jobtargetEasyapply": false
  },
  "companyResult": {
    "companyId": "...",
    "companyName": "Blue Star Partners",
    "companySize": "...",
    "companyDesc": "...",
    "companyLinkedinURL": "...",
    "companyLogo": "...",
    "companyURL": "...",
    "companyLocation": "..."
  },
  "displayScore": 0.95,
  "jobNotes": null
}
```

### Query Object (`pageProps.query`)
```json
{
  "value": "Cybersecurity Contract",
  "country": "US",
  "jobTaxonomyList": [{"taxonomyId": "00-00-00", "title": "Cybersecurity"}],
  "locations": [],
  "jobTypes": [],
  "seniority": [],
  "workModel": []
}
```

---

## Key Characteristics

### Authentication
- **None required.** The endpoint works with a simple GET and browser User-Agent.
- No API keys, tokens, or cookies needed.

### Rate Limiting
- **None observed** in testing (5 rapid requests, 1s apart → all HTTP 200).
- Polite usage recommended: 1-2s between requests.

### Pagination
- **Limited:** Each request returns only **16 jobs** (a sample, not paginated).
- `?page=2`, `?p=2`, `?offset=16` query params are **ignored**.
- Results are **non-deterministic** — repeated requests return different samples.
- `totalJobs` tells you the full count, but there's no way to page through all results via this endpoint.
- **Workaround:** Use varied slugs to get different samples (e.g., `cybersecurity-contract`, `cybersecurity-analyst-contract`, `soc-analyst-contract`).

### Headers
- Requires a browser-like `User-Agent`. Bare curl without UA may be blocked.
- No special headers needed beyond UA.

### Freshness
- `publishTime` and `publishTimeDesc` ("4 hours ago", "2 months ago") included per job.
- Data appears fresh (saw a job posted 4 hours ago in testing).

---

## What Did NOT Work

| Approach | Result |
|----------|--------|
| `https://jobright.ai/api/*` | 404 — no public REST API |
| HTML scraping of `/jobs/*` | Cloudflare Turnstile challenge blocks non-browser clients |
| REA `capture-browser-scenario` | Failed — browser gets `ERR_SSL_PROTOCOL_ERROR` (VM egress proxy issue) |
| Client-side API in JS bundles | None found — app is SSR-heavy, no hardcoded API endpoints in 4MB+ of analyzed JS |
| `?page=N` pagination | Ignored by the data route |

---

## Usability Assessment

### ✅ Strengths
- **Real data:** 7,500 cybersecurity jobs, 2,191 contract-relevant — matches their "8M listings" claim at scale
- **Rich schema:** Title, company, location, posted date, description, employment type, apply URL, coordinates
- **No auth:** Works out of the box
- **Contract filterable:** Via slug keywords (`cybersecurity-contract`)
- **Fresh:** Includes recently posted jobs

### ⚠️ Limitations
- **16 jobs per request** — can't bulk-harvest; only sampling
- **Non-deterministic** — can't reliably deduplicate or paginate
- **BuildId dependency** — must fetch current buildId from homepage before each session
- **Undocumented** — could break without notice on site redeploy

### ⚖️ ToS Considerations
- `robots.txt` explicitly allows `/jobs/*` for crawlers
- However, this `/_next/data/` endpoint is an **internal** Next.js hydration route, not a documented public API
- Using it for a job aggregator is a **gray area** — it's publicly accessible with no auth, but not intended as a public API
- **Recommendation:** Use politely (1-2s delays, reasonable volume), attribute Jobright as the source, link back to their job URLs (which include `utm_source` tracking — they'll get attribution). For production use, consider reaching out for official API access or partnership.

---

## Recommended Integration

```python
import requests, re, time

def get_build_id():
    """Fetch current Next.js buildId (changes on redeploy)."""
    html = requests.get("https://jobright.ai/", 
        headers={"User-Agent": "Mozilla/5.0"}).text
    m = re.search(r'"buildId":"([^"]+)"', html)
    return m.group(1)

def fetch_jobs(keywords, build_id):
    """Fetch a 16-job sample for the given keywords."""
    slug = keywords.lower().replace(" ", "-")
    url = f"https://jobright.ai/_next/data/{build_id}/jobs/{slug}.json"
    resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    data = resp.json()
    return {
        "total": data["pageProps"]["totalJobs"],
        "jobs": [
            {
                "id": j["jobResult"]["jobId"],
                "title": j["jobResult"]["jobTitle"],
                "company": j.get("companyResult", {}).get("companyName"),
                "location": j["jobResult"]["jobLocation"],
                "remote": j["jobResult"]["isRemote"],
                "type": j["jobResult"]["employmentType"],
                "posted": j["jobResult"]["publishTime"],
                "posted_desc": j["jobResult"]["publishTimeDesc"],
                "summary": j["jobResult"]["jobSummary"],
                "url": j["jobResult"]["url"],
            }
            for j in data["pageProps"]["jobList"]
        ]
    }

# Usage
build_id = get_build_id()
for keywords in ["cybersecurity-contract", "soc-analyst-contract", "security-engineer-contract"]:
    result = fetch_jobs(keywords, build_id)
    print(f"{keywords}: {result['total']} total, sampled {len(result['jobs'])}")
    time.sleep(2)  # be polite
```

---

## REA Tool Notes

- `rea capture-browser-scenario` failed in this environment due to `ERR_SSL_PROTOCOL_ERROR` (browser couldn't use the VM's egress proxy for TLS). The Playwright/Chromium launch itself worked.
- Static analysis was done manually: downloaded 30 homepage JS chunks (~1MB) + 20 search-page chunks (~3.4MB) from `static.jobright.ai`, parsed the Next.js build manifest to map routes to chunks.
- Key discovery came from probing Next.js data route conventions (`/_next/data/{buildId}/...`), not from the JS bundles (which contained no API references — confirming SSR architecture).
