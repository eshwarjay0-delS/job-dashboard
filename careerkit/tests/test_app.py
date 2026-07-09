"""
tests/test_app.py — pytest suite for CareerKit Flask app.

Run:
    cd careerkit
    pip install pytest
    pytest tests/ -v

All tests use an in-memory SQLite DB and mock out word_editor + resume_tagger
so no real files or API keys are needed.
"""

import io
import json
import os
import sys
import tempfile
import unittest.mock as mock
from pathlib import Path

import pytest

# Point DB at a temp file so tests don't touch the real careerkit.db
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
os.environ.setdefault("ANTHROPIC_API_KEY", "")


# Patch DB_PATH BEFORE importing db/app
import importlib
import db as _db_module

_db_module.DB_PATH = Path(_tmp_db.name)
_db_module.init_db()  # create tables in the temp db

import app as flask_app


@pytest.fixture
def client():
    flask_app.app.config["TESTING"] = True
    flask_app.app.config["WTF_CSRF_ENABLED"] = False
    # Override upload/output dirs to temp locations
    with tempfile.TemporaryDirectory() as tmpdir:
        flask_app.UPLOAD_DIR = Path(tmpdir) / "uploads"
        flask_app.OUTPUT_DIR = Path(tmpdir) / "outputs"
        flask_app.UPLOAD_DIR.mkdir()
        flask_app.OUTPUT_DIR.mkdir()
        with flask_app.app.test_client() as c:
            yield c


# ─────────────────────────────────────────────────────────────────────────────
# Index / page route
# ─────────────────────────────────────────────────────────────────────────────

class TestIndex:
    def test_index_returns_200(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert b"CareerKit" in r.data

    def test_index_contains_tabs(self, client):
        r = client.get("/")
        assert b"tab-library" in r.data
        assert b"tab-jobs" in r.data
        assert b"tab-tailor" in r.data
        assert b"tab-tracker" in r.data


# ─────────────────────────────────────────────────────────────────────────────
# Resume Library API
# ─────────────────────────────────────────────────────────────────────────────

class TestResumeLibrary:
    def test_list_resumes_empty(self, client):
        r = client.get("/api/resumes")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert isinstance(data, list)

    def test_upload_non_docx_rejected(self, client):
        r = client.post(
            "/api/resumes/upload",
            data={"file": (io.BytesIO(b"not a docx"), "resume.pdf")},
            content_type="multipart/form-data",
        )
        assert r.status_code == 400
        assert b"error" in r.data

    def test_upload_docx_succeeds(self, client):
        # Minimal valid .docx is a zip file — use a real small one or just
        # mock word_editor.extract_text so we don't need a real docx
        minimal_docx = b"PK\x03\x04"  # docx magic bytes prefix (not fully valid but enough for save)
        with mock.patch("app.word_editor.extract_text", return_value="Resume text"):
            with mock.patch("app.resume_tagger.tag_resume", return_value={"domain": "Cybersecurity", "keywords": ["SIEM"]}):
                r = client.post(
                    "/api/resumes/upload",
                    data={"file": (io.BytesIO(minimal_docx), "my_resume.docx")},
                    content_type="multipart/form-data",
                )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["filename"] == "my_resume.docx"
        assert "id" in data

    def test_list_resumes_after_upload(self, client):
        # Upload one
        with mock.patch("app.word_editor.extract_text", return_value="text"):
            client.post(
                "/api/resumes/upload",
                data={"file": (io.BytesIO(b"PK\x03\x04"), "test.docx")},
                content_type="multipart/form-data",
            )
        r = client.get("/api/resumes")
        data = json.loads(r.data)
        names = [row["filename"] for row in data]
        assert "test.docx" in names

    def test_delete_resume(self, client):
        # Upload then delete
        with mock.patch("app.word_editor.extract_text", return_value="text"):
            up = client.post(
                "/api/resumes/upload",
                data={"file": (io.BytesIO(b"PK\x03\x04"), "del_test.docx")},
                content_type="multipart/form-data",
            )
        resume_id = json.loads(up.data)["id"]
        r = client.delete(f"/api/resumes/{resume_id}")
        assert r.status_code == 200
        # Verify it's gone
        listing = json.loads(client.get("/api/resumes").data)
        ids = [row["id"] for row in listing]
        assert resume_id not in ids

    def test_delete_nonexistent_resume(self, client):
        r = client.delete("/api/resumes/99999")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Tailor API
# ─────────────────────────────────────────────────────────────────────────────

class TestTailor:
    def test_tailor_without_key_returns_503(self, client):
        original = flask_app.HAS_KEY
        flask_app.HAS_KEY = False
        r = client.post(
            "/api/tailor",
            data=json.dumps({"jd": "Senior Security Engineer"}),
            content_type="application/json",
        )
        flask_app.HAS_KEY = original
        assert r.status_code == 503

    def test_tailor_without_jd_returns_400(self, client):
        flask_app.HAS_KEY = True
        r = client.post(
            "/api/tailor",
            data=json.dumps({"jd": ""}),
            content_type="application/json",
        )
        flask_app.HAS_KEY = False
        assert r.status_code == 400

    def test_tailor_no_resumes_returns_400(self, client):
        flask_app.HAS_KEY = True
        r = client.post(
            "/api/tailor",
            data=json.dumps({"jd": "Security Engineer role with SIEM experience"}),
            content_type="application/json",
        )
        flask_app.HAS_KEY = False
        assert r.status_code == 400
        assert b"No resumes" in r.data

    def test_tailor_with_resume_returns_result(self, client):
        # Upload a resume first
        with mock.patch("app.word_editor.extract_text", return_value="Eshwar — SIEM Security Engineer"):
            client.post(
                "/api/resumes/upload",
                data={"file": (io.BytesIO(b"PK\x03\x04"), "eshwar.docx")},
                content_type="multipart/form-data",
            )
        # Tag it manually so it's picked up as best match
        rows = json.loads(client.get("/api/resumes").data)
        resume_id = rows[-1]["id"]
        _db_module.update_resume_tags(resume_id, "Cybersecurity", ["SIEM", "Splunk"])

        mock_changes = {
            "score": 82,
            "summary": "Security engineer with 5+ years...",
            "skills": ["SIEM", "Splunk", "Azure Sentinel"],
            "bullets": {},
            "what_changed": ["Updated summary", "Added SIEM keywords"],
        }

        flask_app.HAS_KEY = True
        with mock.patch("app.word_editor.extract_text", return_value="resume text"), \
             mock.patch("app.resume_tagger.tailor_resume", return_value=mock_changes), \
             mock.patch("app.word_editor.apply_tailoring", return_value=None):
            r = client.post(
                "/api/tailor",
                data=json.dumps({"jd": "Senior SIEM Analyst role", "resume_id": resume_id}),
                content_type="application/json",
            )
        flask_app.HAS_KEY = False

        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["score"] == 82
        assert "tailor_id" in data
        assert "what_changed" in data

    def test_download_nonexistent_tailor(self, client):
        r = client.get("/api/tailor/99999/download/docx")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Jobs API
# ─────────────────────────────────────────────────────────────────────────────

class TestJobs:
    def test_jobs_returns_list(self, client):
        # Force sample jobs by mocking remotive to return []
        with mock.patch("app._fetch_remotive", return_value=[]):
            r = client.get("/api/jobs")
        assert r.status_code == 200
        jobs = json.loads(r.data)
        assert isinstance(jobs, list)
        assert len(jobs) > 0

    def test_jobs_have_required_fields(self, client):
        with mock.patch("app._fetch_remotive", return_value=[]):
            # Clear cache first
            flask_app._JOBS_CACHE["ts"] = 0
            r = client.get("/api/jobs")
        jobs = json.loads(r.data)
        for job in jobs:
            assert "id" in job
            assert "title" in job
            assert "company" in job
            assert "url" in job
            assert "visa" in job
            assert "remote" in job
            assert "ats" in job

    def test_jobs_cache_is_used(self, client):
        with mock.patch("app._fetch_remotive", return_value=[]) as mock_fetch:
            flask_app._JOBS_CACHE["ts"] = 0
            client.get("/api/jobs")  # first call → fetches
            client.get("/api/jobs")  # second call → uses cache
        assert mock_fetch.call_count == 1  # fetched only once

    def test_jobs_visa_fields_are_booleans(self, client):
        with mock.patch("app._fetch_remotive", return_value=[]):
            flask_app._JOBS_CACHE["ts"] = 0
            r = client.get("/api/jobs")
        jobs = json.loads(r.data)
        for job in jobs:
            for flag in ["h1b", "gc", "opt", "c2c"]:
                assert isinstance(job["visa"][flag], bool), f"{flag} should be bool"


# ─────────────────────────────────────────────────────────────────────────────
# Applications API (Tracker)
# ─────────────────────────────────────────────────────────────────────────────

class TestApplications:
    def test_list_applications_empty(self, client):
        r = client.get("/api/applications")
        assert r.status_code == 200
        assert isinstance(json.loads(r.data), list)

    def test_create_application(self, client):
        r = client.post(
            "/api/applications",
            data=json.dumps({"title": "Senior OT Engineer", "company": "Cigna", "status": "applied"}),
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "id" in data

    def test_create_then_list(self, client):
        client.post(
            "/api/applications",
            data=json.dumps({"title": "AppSec Engineer", "company": "Capital One", "status": "saved"}),
            content_type="application/json",
        )
        apps = json.loads(client.get("/api/applications").data)
        titles = [a["title"] for a in apps]
        assert "AppSec Engineer" in titles

    def test_update_application_status(self, client):
        # Create
        r = client.post(
            "/api/applications",
            data=json.dumps({"title": "ServiceNow Dev", "company": "Deloitte", "status": "saved"}),
            content_type="application/json",
        )
        app_id = json.loads(r.data)["id"]

        # Move to applied
        r2 = client.put(
            f"/api/applications/{app_id}",
            data=json.dumps({"status": "applied"}),
            content_type="application/json",
        )
        assert r2.status_code == 200

        # Verify
        apps = json.loads(client.get("/api/applications").data)
        matching = [a for a in apps if a["id"] == app_id]
        assert matching[0]["status"] == "applied"

    def test_update_rejects_unknown_fields(self, client):
        r = client.post(
            "/api/applications",
            data=json.dumps({"title": "GRC Analyst", "company": "JPMorgan", "status": "applied"}),
            content_type="application/json",
        )
        app_id = json.loads(r.data)["id"]

        # Try to update with a disallowed field — should silently ignore it
        r2 = client.put(
            f"/api/applications/{app_id}",
            data=json.dumps({"status": "interview", "created_at": "1970-01-01"}),
            content_type="application/json",
        )
        assert r2.status_code == 200
        apps = json.loads(client.get("/api/applications").data)
        matching = [a for a in apps if a["id"] == app_id][0]
        # created_at should NOT have been overwritten with "1970-01-01"
        assert matching["created_at"] != "1970-01-01"

    def test_delete_application(self, client):
        r = client.post(
            "/api/applications",
            data=json.dumps({"title": "To Delete", "company": "Acme", "status": "applied"}),
            content_type="application/json",
        )
        app_id = json.loads(r.data)["id"]
        del_r = client.delete(f"/api/applications/{app_id}")
        assert del_r.status_code == 200
        apps = json.loads(client.get("/api/applications").data)
        assert all(a["id"] != app_id for a in apps)

    def test_full_kanban_flow(self, client):
        """Simulate: saved → applied → interview → offer"""
        r = client.post(
            "/api/applications",
            data=json.dumps({"title": "SRE", "company": "Netflix", "status": "saved"}),
            content_type="application/json",
        )
        app_id = json.loads(r.data)["id"]

        for status in ["applied", "interview", "offer"]:
            client.put(
                f"/api/applications/{app_id}",
                data=json.dumps({"status": status}),
                content_type="application/json",
            )

        apps = json.loads(client.get("/api/applications").data)
        final = [a for a in apps if a["id"] == app_id][0]
        assert final["status"] == "offer"


# ─────────────────────────────────────────────────────────────────────────────
# Feedback API
# ─────────────────────────────────────────────────────────────────────────────

class TestFeedback:
    def test_feedback_without_tailor_id_fails(self, client):
        r = client.post(
            "/api/feedback",
            data=json.dumps({"tags": ["Looks great"]}),
            content_type="application/json",
        )
        assert r.status_code == 400

    def test_feedback_without_content_fails(self, client):
        r = client.post(
            "/api/feedback",
            data=json.dumps({"tailor_id": 1, "tags": [], "custom": ""}),
            content_type="application/json",
        )
        assert r.status_code == 400

    def test_feedback_saves_successfully(self, client):
        # We need a real tailor_id row in the DB
        import db
        tailor_id = db.insert_tailor(None, "test jd", {}, 75, "/tmp/fake.docx")

        r = client.post(
            "/api/feedback",
            data=json.dumps({"tailor_id": tailor_id, "tags": ["More keywords"], "custom": ""}),
            content_type="application/json",
        )
        assert r.status_code == 200
        assert json.loads(r.data)["ok"] is True


# ─────────────────────────────────────────────────────────────────────────────
# db module unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDB:
    def test_insert_and_get_resume(self):
        import db
        rid = db.insert_resume("test.docx", "/tmp/test.docx")
        row = db.get_resume(rid)
        assert row["filename"] == "test.docx"
        assert row["domain"] is None  # not tagged yet

    def test_update_resume_tags(self):
        import db
        rid = db.insert_resume("tagged.docx", "/tmp/tagged.docx")
        db.update_resume_tags(rid, "DevOps", ["Terraform", "AWS", "K8s"])
        row = db.get_resume(rid)
        assert row["domain"] == "DevOps"
        assert "Terraform" in json.loads(row["keywords"])
        assert row["tagged_at"] is not None

    def test_get_nonexistent_resume_returns_none(self):
        import db
        assert db.get_resume(999999) is None

    def test_insert_tailor_returns_id(self):
        import db
        tid = db.insert_tailor(1, "Senior Engineer JD", {"score": 80}, 80, "/tmp/out.docx")
        assert isinstance(tid, int)
        assert tid > 0

    def test_get_tailor(self):
        import db
        tid = db.insert_tailor(1, "Some JD text", {}, 65, "/tmp/out65.docx")
        row = db.get_tailor(tid)
        assert row["score"] == 65

    def test_save_and_get_feedback(self):
        import db
        tid = db.insert_tailor(1, "JD for feedback test", {}, 70, "/tmp/fb.docx")
        db.save_feedback(tid, ["Shorter bullets", "More keywords"], "Also reduce jargon")
        rows = db.get_recent_feedback(1)
        assert len(rows) >= 1
        assert "Shorter bullets" in json.loads(rows[0]["tags"])

    def test_insert_application(self):
        import db
        aid = db.insert_application("Python Dev", "OpenAI", url="https://openai.com/jobs",
                                     status="applied", salary="$180K")
        row_list = db.list_applications()
        matching = [r for r in row_list if r["id"] == aid]
        assert len(matching) == 1
        assert matching[0]["company"] == "OpenAI"

    def test_update_application_allowed_fields_only(self):
        import db
        aid = db.insert_application("DevOps Eng", "Amazon", status="saved")
        db.update_application(aid, {"status": "applied", "title": "Senior DevOps", "id": 999})
        rows = db.list_applications()
        match = [r for r in rows if r["id"] == aid][0]
        assert match["status"] == "applied"
        assert match["title"] == "Senior DevOps"
        assert match["id"] == aid  # id not overwritten

    def test_delete_application(self):
        import db
        aid = db.insert_application("To Delete", "Corp", status="rejected")
        db.delete_application(aid)
        rows = db.list_applications()
        assert all(r["id"] != aid for r in rows)
