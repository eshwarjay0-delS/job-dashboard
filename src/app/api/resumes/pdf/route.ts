import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import mammoth from "mammoth"
import { RESUMES_LIB as RESUMES_DIR, USER_RESUMES_DIR as USER_RESUMES_BASE } from "@/lib/paths"
import { createClientFromRequest } from "@/lib/supabase/server"

// This route uses Node APIs (fs) + mammoth — force the Node.js runtime.
export const runtime = "nodejs"

// GET /api/resumes/pdf?filepath=<path>&name=<filename>&autoprint=1
// Reads the .docx, converts it to clean HTML, and returns a print-ready page.
// The page auto-opens the browser's print dialog → the user picks "Save as PDF".
// This produces a real PDF of the real resume content, with NO
// system tools (Word / LibreOffice) required.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const filepath  = searchParams.get("filepath") ?? ""
  const name      = searchParams.get("name") ?? "Resume"
  const autoprint = searchParams.get("autoprint") !== "0"

  if (!filepath) {
    return htmlError("No resume file was provided.")
  }

  // Scope user-uploaded resumes to the requesting user's own folder only — the
  // shared library (RESUMES_DIR) has no owner and stays open to any caller,
  // same convention /api/resumes/download and /api/profile's ?filepath= use.
  let userId = ""
  try {
    const supabase = await createClientFromRequest(request)
    const { data } = await supabase.auth.getUser()
    if (data.user?.id) userId = data.user.id
  } catch { /* unauthenticated */ }

  const resolved  = path.resolve(filepath)
  const sharedLib = path.resolve(RESUMES_DIR)
  const userBase  = path.resolve(USER_RESUMES_BASE)

  if (resolved.startsWith(sharedLib + path.sep) || resolved === sharedLib) {
    // Shared library — no per-user restriction needed
  } else if (resolved.startsWith(userBase + path.sep)) {
    if (!userId) {
      return htmlError("Please sign in to view this resume.")
    }
    const userFolder = path.resolve(path.join(userBase, userId))
    if (!resolved.startsWith(userFolder + path.sep) && resolved !== userFolder) {
      return htmlError("That file is outside your resumes folder, so it can't be opened.")
    }
  } else {
    return htmlError("That file is outside the resumes folder, so it can't be opened.")
  }

  let bodyHtml = ""
  try {
    const buffer = await readFile(resolved)
    const result = await mammoth.convertToHtml({ buffer })
    bodyHtml = result.value || "<p>(This resume appears to be empty.)</p>"
  } catch (e) {
    return htmlError(
      "Couldn't convert that resume to a PDF view.",
      "The file may have been moved, renamed, or isn't a valid .docx. " +
        `<br><br><code>${escapeHtml(String(e)).slice(0, 200)}</code>`
    )
  }

  const safeName = escapeHtml(name)
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName}</title>
<style>
  :root { --ink:#1a1a1a; --muted:#555; --rule:#d9d9d9; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f3f4f6; }
  body {
    font-family: "Calibri", "Segoe UI", Arial, sans-serif;
    color: var(--ink); line-height: 1.5; font-size: 11pt;
  }
  .toolbar {
    position: sticky; top: 0; display: flex; gap: 10px; align-items: center;
    justify-content: center; padding: 12px; background: #111827; color: #fff;
  }
  .toolbar button {
    font: inherit; font-weight: 600; border: 0; cursor: pointer;
    padding: 9px 18px; border-radius: 9px; background: #0d9488; color: #fff;
  }
  .toolbar button:hover { background: #0f766e; }
  .toolbar span { font-size: 13px; color: #cbd5e1; }
  .sheet {
    background: #fff; max-width: 8.27in; margin: 18px auto; padding: 0.7in 0.8in;
    box-shadow: 0 1px 12px rgba(0,0,0,.12);
  }
  .sheet h1 { font-size: 19pt; margin: 0 0 2px; }
  .sheet h2 {
    font-size: 12.5pt; margin: 16px 0 6px; padding-bottom: 3px;
    border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: .4px;
  }
  .sheet h3 { font-size: 11.5pt; margin: 10px 0 2px; }
  .sheet p  { margin: 4px 0; }
  .sheet ul { margin: 4px 0 8px; padding-left: 20px; }
  .sheet li { margin: 2px 0; }
  .sheet a  { color: var(--ink); text-decoration: none; }
  @media print {
    .toolbar { display: none; }
    html, body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    @page { margin: 0.6in; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">⬇ Save as PDF</button>
    <span>Tip: in the print window, set "Destination" to <b>Save as PDF</b>.</span>
  </div>
  <div class="sheet">
    ${bodyHtml}
  </div>
  ${autoprint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)})</script>' : ""}
</body>
</html>`

  return new NextResponse(page, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

function htmlError(title: string, detail = ""): NextResponse {
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>PDF export</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f3f4f6;margin:0;padding:60px 20px;text-align:center;color:#1f2937}
.card{background:#fff;max-width:440px;margin:0 auto;padding:32px;border-radius:16px;box-shadow:0 1px 12px rgba(0,0,0,.1)}
h1{font-size:18px;margin:0 0 10px}p{color:#6b7280;font-size:14px;line-height:1.6}
code{background:#f3f4f6;padding:2px 8px;border-radius:6px;font-family:Consolas,monospace;color:#0f766e}</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1><p>${detail || "Please try again."}</p></div></body></html>`
  return new NextResponse(page, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })
}
