"""
db.py — SQLite database for CareerKit.
Stores resume metadata, tailor history, user feedback, and application tracking.
"""

import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "careerkit.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS resumes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                filename  TEXT NOT NULL,
                filepath  TEXT NOT NULL,
                domain    TEXT,
                keywords  TEXT,  -- JSON array
                tagged_at TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tailor_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                resume_id   INTEGER REFERENCES resumes(id),
                jd_snippet  TEXT,
                changes     TEXT,  -- JSON
                score       INTEGER,
                output_path TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS feedback (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tailor_id   INTEGER REFERENCES tailor_history(id),
                tags        TEXT,  -- JSON array of quick-tap tags
                custom_text TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS applications (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                company     TEXT NOT NULL,
                url         TEXT,
                status      TEXT DEFAULT 'applied',  -- saved | applied | interview | offer | rejected
                notes       TEXT,
                resume_id   INTEGER REFERENCES resumes(id),
                ats         TEXT,
                salary      TEXT,
                location    TEXT,
                created_at  TEXT DEFAULT (datetime('now')),
                updated_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_resumes_domain ON resumes(domain);
            CREATE INDEX IF NOT EXISTS idx_tailor_resume  ON tailor_history(resume_id);
            CREATE INDEX IF NOT EXISTS idx_apps_status    ON applications(status);
        """)


# ── Resumes ──────────────────────────────────────────────────────────────────

def insert_resume(filename: str, filepath: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO resumes (filename, filepath) VALUES (?, ?)",
            (filename, filepath),
        )
        return cur.lastrowid


def update_resume_tags(resume_id: int, domain: str, keywords: list[str]):
    with get_conn() as conn:
        conn.execute(
            """UPDATE resumes
               SET domain=?, keywords=?, tagged_at=datetime('now')
               WHERE id=?""",
            (domain, json.dumps(keywords), resume_id),
        )


def list_resumes() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM resumes ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_resume(resume_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM resumes WHERE id=?", (resume_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_resume(resume_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM resumes WHERE id=?", (resume_id,))


# ── Tailor history ────────────────────────────────────────────────────────────

def insert_tailor(resume_id: int, jd_snippet: str, changes: dict, score: int, output_path: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO tailor_history (resume_id, jd_snippet, changes, score, output_path)
               VALUES (?, ?, ?, ?, ?)""",
            (resume_id, jd_snippet[:300], json.dumps(changes), score, output_path),
        )
        return cur.lastrowid


def get_tailor(tailor_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM tailor_history WHERE id=?", (tailor_id,)
        ).fetchone()
    return dict(row) if row else None


# ── Feedback ─────────────────────────────────────────────────────────────────

def save_feedback(tailor_id: int, tags: list[str], custom_text: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO feedback (tailor_id, tags, custom_text) VALUES (?,?,?)",
            (tailor_id, json.dumps(tags), custom_text),
        )


def get_recent_feedback(limit: int = 5) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# ── Applications ─────────────────────────────────────────────────────────────

def insert_application(title: str, company: str, url: str = "", status: str = "applied",
                        notes: str = "", resume_id=None, ats: str = "", salary: str = "", location: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO applications (title, company, url, status, notes, resume_id, ats, salary, location)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (title, company, url, status, notes, resume_id, ats, salary, location),
        )
        return cur.lastrowid


def list_applications() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM applications ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def update_application(app_id: int, fields: dict):
    allowed = {"title", "company", "url", "status", "notes", "ats", "salary", "location"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [app_id]
    with get_conn() as conn:
        conn.execute(
            f"UPDATE applications SET {set_clause}, updated_at=datetime('now') WHERE id=?",
            values,
        )


def delete_application(app_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM applications WHERE id=?", (app_id,))


# Auto-initialise on import
try:
    init_db()
except Exception as _e:
    import sys
    print(f"[db] WARNING: could not initialise database: {_e}", file=sys.stderr)
