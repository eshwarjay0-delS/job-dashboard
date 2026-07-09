"""
resume_tagger.py — Claude API calls for tagging and tailoring resumes.
Uses claude-haiku-3-5 for speed + cost, with prompt caching on the system prompt.
"""

import json
import os
import re

import anthropic

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set in .env")
        _client = anthropic.Anthropic(api_key=key)
    return _client


MODEL = "claude-haiku-4-5"

# Cached system prompt — sent once, billed once per cache TTL (~5 min).
SYSTEM = {
    "type": "text",
    "text": (
        "You are a professional resume analyst and career coach. "
        "You respond ONLY with valid JSON — no markdown, no prose, no code fences. "
        "Always keep output concise to minimise token cost."
    ),
    "cache_control": {"type": "ephemeral"},
}


# ── Tag a single resume ───────────────────────────────────────────────────────

def tag_resume(text: str) -> dict:
    """
    Return {"domain": str, "keywords": [str, ...]} for a resume.
    domain is one of: Cybersecurity, DevOps, AI/Data, Full Stack, Cloud, Other.
    keywords is ≤ 12 top skills/tools.
    """
    prompt = (
        "Analyse this resume and return JSON with exactly two keys:\n"
        '  "domain": one of [Cybersecurity, DevOps, AI/Data, Full Stack, Cloud, Other]\n'
        '  "keywords": array of up to 12 top skills/tools\n\n'
        f"RESUME:\n{text[:3000]}"
    )

    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=200,
        system=[SYSTEM],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = resp.content[0].text.strip()
    return _parse_json(raw, {"domain": "Other", "keywords": []})


# ── Tailor a resume to a JD ───────────────────────────────────────────────────

def tailor_resume(resume_text: str, jd_text: str, feedback_hints: list[str] | None = None) -> dict:
    """
    Return:
    {
      "score": int (0-100),
      "summary": "new summary paragraph",
      "skills":  ["skill1", "skill2", ...],
      "bullets": {"Old bullet": "New bullet", ...},  # up to 5
      "what_changed": ["short explanation 1", ...]   # 3-5 items
    }
    """
    feedback_block = ""
    if feedback_hints:
        feedback_block = "\n\nApply this feedback from the user's past sessions:\n- " + "\n- ".join(feedback_hints)

    prompt = (
        "You are tailoring a resume for the job description below.\n"
        "Return JSON with keys: score (int 0-100), summary (string), "
        "skills (array), bullets (object mapping old→new, max 5), "
        "what_changed (array of 3-5 short strings).\n"
        f"{feedback_block}\n\n"
        f"JOB DESCRIPTION:\n{jd_text[:2000]}\n\n"
        f"RESUME:\n{resume_text[:3000]}"
    )

    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=1200,
        system=[SYSTEM],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = resp.content[0].text.strip()
    return _parse_json(raw, {
        "score": 50,
        "summary": "",
        "skills": [],
        "bullets": {},
        "what_changed": ["Tailoring applied"],
    })


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_json(text: str, fallback: dict) -> dict:
    # Strip markdown code fences if Claude adds them despite instructions
    text = re.sub(r"```[a-z]*\n?", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return fallback
