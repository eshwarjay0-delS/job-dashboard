"""
app.py — CareerKit Flask server.
Endpoints: upload, tag, list, delete resumes; tailor; download docx/pdf; feedback.
"""

import json
import os
import threading
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_file

import db
import resume_tagger
import word_editor

load_dotenv()

app = Flask(__name__)

UPLOAD_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

HAS_KEY = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", has_key=HAS_KEY)


# ── Resume Library ────────────────────────────────────────────────────────────

@app.route("/api/resumes", methods=["GET"])
def list_resumes():
    return jsonify(db.list_resumes())


@app.route("/api/resumes/upload", methods=["POST"])
def upload_resume():
    file = request.files.get("file")
    if not file or not file.filename.endswith(".docx"):
        return jsonify({"error": "Please upload a .docx file"}), 400

    save_path = UPLOAD_DIR / file.filename
    file.save(save_path)
    resume_id = db.insert_resume(file.filename, str(save_path))

    # Kick off background tagging if we have a key
    if HAS_KEY:
        threading.Thread(target=_tag_in_background, args=(resume_id, str(save_path)), daemon=True).start()

    return jsonify({"id": resume_id, "filename": file.filename, "tagging": HAS_KEY})


def _tag_in_background(resume_id: int, filepath: str):
    try:
        text = word_editor.extract_text(filepath)
        result = resume_tagger.tag_resume(text)
        db.update_resume_tags(resume_id, result.get("domain", "Other"), result.get("keywords", []))
    except Exception as e:
        print(f"[tag error] resume {resume_id}: {e}")


@app.route("/api/resumes/<int:resume_id>", methods=["DELETE"])
def delete_resume(resume_id):
    row = db.get_resume(resume_id)
    if not row:
        return jsonify({"error": "Not found"}), 404
    Path(row["filepath"]).unlink(missing_ok=True)
    db.delete_resume(resume_id)
    return jsonify({"ok": True})


# ── Tailor ────────────────────────────────────────────────────────────────────

@app.route("/api/tailor", methods=["POST"])
def tailor():
    if not HAS_KEY:
        return jsonify({"error": "No Claude API key — add it to .env and restart"}), 503

    body = request.get_json(force=True)
    jd_text = (body.get("jd") or "").strip()
    resume_id = body.get("resume_id")
    filepath = (body.get("filepath") or "").strip()

    if not jd_text:
        return jsonify({"error": "Job description is required"}), 400

    # Pick resume: direct filepath takes priority (sent by the Next.js frontend),
    # then explicit id, then best-tagged resume in the CareerKit library.
    if filepath and Path(filepath).is_file():
        row = {
            "id": None,          # NULL — not in the library
            "filename": Path(filepath).stem,
            "filepath": filepath,
        }
        resume_text = word_editor.extract_text(filepath)
    elif resume_id:
        row = db.get_resume(int(resume_id))
        if not row:
            return jsonify({"error": "Resume not found"}), 404
        resume_text = word_editor.extract_text(row["filepath"])
    else:
        rows = db.list_resumes()
        row = next((r for r in rows if r.get("tagged_at")), rows[0] if rows else None)
        if not row:
            return jsonify({"error": "No resumes in library — upload one first"}), 400
        resume_text = word_editor.extract_text(row["filepath"])

    # Apply past feedback as hints
    feedback_rows = db.get_recent_feedback(5)
    hints = []
    for f in feedback_rows:
        tags = json.loads(f.get("tags") or "[]")
        hints.extend(tags)
        if f.get("custom_text"):
            hints.append(f["custom_text"])

    changes = resume_tagger.tailor_resume(resume_text, jd_text, hints or None)

    # Write tailored .docx
    out_docx = OUTPUT_DIR / f"tailored_{row['id']}.docx"
    word_editor.apply_tailoring(row["filepath"], str(out_docx), changes)

    tailor_id = db.insert_tailor(
        row["id"], jd_text, changes, changes.get("score", 50), str(out_docx)
    )

    return jsonify({
        "tailor_id": tailor_id,
        "resume_name": row["filename"],
        "score": changes.get("score", 50),
        "what_changed": changes.get("what_changed", []),
    })


@app.route("/api/tailor/<int:tailor_id>/download/docx")
def download_docx(tailor_id):
    row = db.get_tailor(tailor_id)
    if not row:
        return jsonify({"error": "Not found"}), 404
    return send_file(row["output_path"], as_attachment=True,
                     download_name="tailored_resume.docx")


@app.route("/api/tailor/<int:tailor_id>/download/pdf")
def download_pdf(tailor_id):
    row = db.get_tailor(tailor_id)
    if not row:
        return jsonify({"error": "Not found"}), 404

    pdf_path = str(Path(row["output_path"]).with_suffix(".pdf"))
    try:
        word_editor.convert_to_pdf(row["output_path"], pdf_path)
    except Exception as e:
        return jsonify({"error": f"PDF conversion failed: {e}"}), 500

    return send_file(pdf_path, as_attachment=True, download_name="tailored_resume.pdf")


# ── Feedback ──────────────────────────────────────────────────────────────────

@app.route("/api/feedback", methods=["POST"])
def save_feedback():
    body = request.get_json(force=True)
    tailor_id = body.get("tailor_id")
    tags = body.get("tags", [])
    custom = body.get("custom", "").strip()

    if not tailor_id:
        return jsonify({"error": "tailor_id required"}), 400
    if not tags and not custom:
        return jsonify({"error": "Provide at least one tag or custom feedback"}), 400

    db.save_feedback(int(tailor_id), tags, custom)
    return jsonify({"ok": True})


# ── Jobs API ─────────────────────────────────────────────────────────────────

_JOBS_CACHE = {"data": [], "ts": 0}
_JOBS_TTL = 300  # 5 min cache


def _fetch_remotive():
    try:
        url = "https://remotive.com/api/remote-jobs?limit=80&category=software-dev"
        req = urllib.request.Request(url, headers={"User-Agent": "CareerKit/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read()).get("jobs", [])
    except Exception:
        return []


def _normalize_job(j):
    desc = (j.get("description") or "").lower()
    url = j.get("url", "")
    ats = ("workday" if "workday" in url else
           "greenhouse" if "greenhouse.io" in url else
           "lever" if "lever.co" in url else
           "taleo" if "taleo" in url else
           "icims" if "icims" in url else
           "smartrecruiters" if "smartrecruiters" in url else "unknown")
    return {
        "id": j.get("id"), "title": j.get("title", ""), "company": j.get("company_name", ""),
        "location": j.get("candidate_required_location") or "Remote",
        "tags": j.get("tags", [])[:6], "url": url,
        "posted": (j.get("publication_date") or "")[:10],
        "salary": j.get("salary", ""), "logo": j.get("company_logo", ""),
        "visa": {
            "h1b": any(k in desc for k in ["h1b", "h-1b", "sponsor"]),
            "gc":  any(k in desc for k in ["green card", "gc holder"]),
            "opt": any(k in desc for k in ["opt", "cpt"]),
            "c2c": any(k in desc for k in ["c2c", "corp to corp", "1099"]),
        },
        "remote": True, "ats": ats,
    }


def _sample_jobs():
    return [
        {"id":1,  "title":"Senior OT Security Engineer",       "company":"Cigna Health",    "location":"Remote · USA","tags":["SCADA","ICS","NERC CIP","Dragos","Splunk"],    "url":"https://boards.greenhouse.io/cigna/",      "posted":"2026-06-28","salary":"$140K–$180K","logo":"","visa":{"h1b":False,"gc":True,"opt":False,"c2c":True},"remote":True,"ats":"greenhouse"},
        {"id":2,  "title":"ServiceNow Developer / Admin",       "company":"Deloitte",        "location":"Remote · USA","tags":["ServiceNow","ITSM","JavaScript","GRC","ITOM"], "url":"https://jobs.lever.co/deloitte/sn-dev",    "posted":"2026-06-27","salary":"$120K–$155K","logo":"","visa":{"h1b":True,"gc":True,"opt":False,"c2c":False},"remote":True,"ats":"lever"},
        {"id":3,  "title":"Senior AppSec Engineer",             "company":"Capital One",     "location":"Remote · USA","tags":["SAST","DAST","Burp Suite","OWASP","AWS"],    "url":"https://capitalone.wd1.myworkdayjobs.com/","posted":"2026-06-26","salary":"$150K–$195K","logo":"","visa":{"h1b":False,"gc":False,"opt":False,"c2c":False},"remote":True,"ats":"workday"},
        {"id":4,  "title":"Cloud DevOps Engineer",              "company":"Amazon",          "location":"Seattle, WA", "tags":["AWS","Terraform","Kubernetes","CI/CD","Python"],"url":"https://amazon.jobs/en/",                 "posted":"2026-06-25","salary":"$135K–$175K","logo":"","visa":{"h1b":True,"gc":True,"opt":True,"c2c":False},"remote":False,"ats":"unknown"},
        {"id":5,  "title":"Python AI/ML Engineer",              "company":"OpenAI",          "location":"Remote · USA","tags":["Python","PyTorch","LLMs","REST APIs","RAG"],  "url":"https://boards.greenhouse.io/openai/",     "posted":"2026-06-24","salary":"$160K–$220K","logo":"","visa":{"h1b":False,"gc":False,"opt":False,"c2c":False},"remote":True,"ats":"greenhouse"},
        {"id":6,  "title":"Full Stack Developer (React+Node)",  "company":"Stripe",          "location":"Remote · USA","tags":["React","Node.js","TypeScript","PostgreSQL"],  "url":"https://stripe.com/jobs/",                 "posted":"2026-06-23","salary":"$145K–$185K","logo":"","visa":{"h1b":True,"gc":True,"opt":False,"c2c":False},"remote":True,"ats":"unknown"},
        {"id":7,  "title":"GRC Analyst (CISSP preferred)",      "company":"JPMorgan Chase",  "location":"New York, NY","tags":["GRC","CISSP","ISO 27001","Risk","Compliance"], "url":"https://jpmc.fa.oraclecloud.com/",         "posted":"2026-06-22","salary":"$110K–$145K","logo":"","visa":{"h1b":False,"gc":True,"opt":False,"c2c":False},"remote":False,"ats":"taleo"},
        {"id":8,  "title":"Cybersecurity Engineer (C2C OK)",    "company":"Booz Allen",      "location":"McLean, VA",  "tags":["Pen Testing","OSCP","CySA+","NIST","SIEM"],  "url":"https://careers.boozallen.com/",           "posted":"2026-06-21","salary":"$90–$110/hr C2C","logo":"","visa":{"h1b":False,"gc":True,"opt":False,"c2c":True},"remote":False,"ats":"unknown"},
        {"id":9,  "title":"Site Reliability Engineer",          "company":"Netflix",         "location":"Remote · USA","tags":["SRE","Kubernetes","Python","Prometheus","Go"],"url":"https://jobs.netflix.com/",               "posted":"2026-06-20","salary":"$175K–$225K","logo":"","visa":{"h1b":False,"gc":False,"opt":False,"c2c":False},"remote":True,"ats":"unknown"},
        {"id":10, "title":"Information Security Architect",     "company":"Lockheed Martin", "location":"Fort Worth, TX","tags":["Zero Trust","NIST","Cloud","Firewall","IAM"],"url":"https://www.lockheedmartinjobs.com/",    "posted":"2026-06-19","salary":"$155K–$200K","logo":"","visa":{"h1b":False,"gc":True,"opt":False,"c2c":False},"remote":False,"ats":"unknown"},
    ]


@app.route("/api/jobs")
def get_jobs():
    now = time.time()
    if _JOBS_CACHE["data"] and now - _JOBS_CACHE["ts"] < _JOBS_TTL:
        return jsonify(_JOBS_CACHE["data"])

    raw = _fetch_remotive()
    live = len(raw) > 5
    jobs = [_normalize_job(j) for j in raw] if live else _sample_jobs()
    _JOBS_CACHE["data"] = jobs
    _JOBS_CACHE["ts"] = now
    _JOBS_CACHE["live"] = live
    return jsonify(jobs)


# ── Applications API ──────────────────────────────────────────────────────────

@app.route("/api/applications", methods=["GET"])
def list_applications():
    return jsonify(db.list_applications())


@app.route("/api/applications", methods=["POST"])
def add_application():
    body = request.get_json(force=True)
    app_id = db.insert_application(
        title=body.get("title", ""),
        company=body.get("company", ""),
        url=body.get("url", ""),
        status=body.get("status", "applied"),
        notes=body.get("notes", ""),
        resume_id=body.get("resume_id"),
        ats=body.get("ats", ""),
        salary=body.get("salary", ""),
        location=body.get("location", ""),
    )
    return jsonify({"id": app_id})


@app.route("/api/applications/<int:app_id>", methods=["PUT"])
def update_application(app_id):
    body = request.get_json(force=True)
    db.update_application(app_id, body)
    return jsonify({"ok": True})


@app.route("/api/applications/<int:app_id>", methods=["DELETE"])
def delete_application(app_id):
    db.delete_application(app_id)
    return jsonify({"ok": True})


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    status = "with Claude key ✓" if HAS_KEY else "NO Claude key — add to .env"
    print(f"\n  CareerKit running ({status})")
    print("  → http://localhost:5050\n")
    app.run(host="0.0.0.0", port=5050, debug=False)
