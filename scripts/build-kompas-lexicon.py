#!/usr/bin/env python3
"""Rebuild the per-profile keyword index from resumes/*.docx.

One lexicon per email. A file that names two profile emails is skipped.
Lines that name another profile or the other city are not indexed.
"""
import json
import os
import re
import zipfile

ROOT = os.getcwd()
OUT = os.path.join(ROOT, "src/lib/kompas-lexicon.json")
PROFILES = ["jayeshwar44", "eshwarjay05", "eshwarjay06", "jayeshwar24"]
OTHER = re.compile(r"\b(?:jayeshwar44|eshwarjay05|eshwarjay06|jayeshwar24|houston|saint louis|st\.?\s*louis)\b", re.I)
SYNONYMS = {
    "siem": ["SIEM", "security information and event management"],
    "iam": ["IAM", "identity and access management"],
    "sase": ["SASE", "secure access service edge"],
    "tprm": ["TPRM", "third-party risk management", "third party risk management"],
    "pam": ["PAM", "privileged access management"],
    "edr": ["EDR", "endpoint detection and response"],
    "soar": ["SOAR", "security orchestration automation and response"],
    "grc": ["GRC", "governance risk and compliance"],
}

def docx_text(path):
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml").decode("utf-8", "ignore")
    text = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"[ \t]+", " ", text)

def profile_of(text):
    low = text.lower()
    hits = [pid for pid in PROFILES if pid + "@" in low]
    return hits[0] if len(hits) == 1 else ""

def clip(line):
    clean = re.sub(r"\s+", " ", line).strip()
    if len(clean) <= 140:
        return clean
    cut = clean[:137]
    return cut[: cut.rfind(" ")] if " " in cut else cut

def add(index, profile, term, evidence, source):
    key = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#./ -]+", " ", term.lower())).strip()
    if len(key) < 3 or len(key) > 60:
        return
    bag = index.setdefault(profile, {})
    row = bag.setdefault(key, {"term": key, "surface": term, "evidence": [], "sources": []})
    if evidence and evidence not in row["evidence"] and len(row["evidence"]) < 2:
        row["evidence"].append(evidence)
    if source and source not in row["sources"] and len(row["sources"]) < 3:
        row["sources"].append(source)

index = {}
files = []
for dirpath, _, names in os.walk(os.path.join(ROOT, "resumes")):
    for name in names:
        if name.lower().endswith(".docx"):
            files.append(os.path.join(dirpath, name))

used = 0
for path in files:
    text = docx_text(path)
    profile = profile_of(text)
    if not profile:
        continue
    used += 1
    source = os.path.relpath(path, ROOT)
    for line in text.split("\n"):
        line = line.strip()
        if len(line) < 12:
            continue
        if OTHER.search(line) and profile not in line.lower():
            continue
        evidence = clip(line)
        for token in re.findall(r"\b[A-Z][A-Z0-9+/&-]{1,8}\b", line):
            add(index, profile, token, evidence, source)
        if re.search(r"\b(?:owned|built|led|designed|implemented|monitored|deployed|tuned|migrated)\b", line, re.I):
            phrase = " ".join(line.split(";")[0].split()[:8])
            if len(phrase.split()) >= 3:
                add(index, profile, phrase, evidence, source)
    low = text.lower()
    for forms in SYNONYMS.values():
        if any(form.lower() in low for form in forms):
            for form in forms:
                add(index, profile, form, "Known on this profile as %s." % forms[0], source)

with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(index, fh, separators=(",", ":"))
counts = {pid: len(index.get(pid, {})) for pid in PROFILES}
print(json.dumps({"files": len(files), "used": used, "counts": counts, "bytes": os.path.getsize(OUT)}))
