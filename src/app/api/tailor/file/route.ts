import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import JSZip from "jszip"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"

// Extract the document's primary font from styles.xml so the PDF output uses
// the same typeface the candidate chose for their resume, not a generic fallback.
async function extractDocxFont(buffer: Buffer): Promise<{ body: string; heading: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const stylesFile = zip.file("word/styles.xml")
    if (!stylesFile) return { body: "Calibri", heading: "Calibri" }
    const xml = await stylesFile.async("string")

    // w:docDefaults carries the document-wide font
    const defaultFont = (xml.match(/<w:docDefaults[\s\S]*?<\/w:docDefaults>/) || [""])[0]
    const asciiMatch = defaultFont.match(/w:ascii="([^"]+)"/)
    const themeMatch = defaultFont.match(/w:asciiTheme="([^"]+)"/)
    const bodyFont = asciiMatch?.[1] || (themeMatch?.[1]?.toLowerCase().includes("minor") ? "Calibri" : "Cambria") || "Calibri"

    // Heading styles (Normal heading or first h1/h2 definition)
    const h1Block = (xml.match(/<w:style[^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/) || [""])[0]
    const h1Ascii = h1Block.match(/w:ascii="([^"]+)"/)
    const headingFont = h1Ascii?.[1] || bodyFont

    return { body: bodyFont, heading: headingFont }
  } catch {
    return { body: "Calibri", heading: "Calibri" }
  }
}

// GET /api/tailor/file?token=<token>&fmt=docx|pdf|preview&name=<name>
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = (searchParams.get("token") || "").replace(/[^a-z0-9]/gi, "")
  const fmtParam = searchParams.get("fmt") || "docx"
  const fmt = ["pdf", "preview", "docx"].includes(fmtParam) ? fmtParam : "docx"
  // Keep "&()+" so role/company titles survive (e.g. "IAM Engineer (GCP)",
  // "Testing & Validation"); still strips path-traversal / unsafe chars.
  const name = (searchParams.get("name") || "Resume").replace(/[^a-z0-9_\-. &()+]/gi, "_")

  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })

  const buffer = await blob.get(`tailored/${token}.docx`)
  if (!buffer) {
    return NextResponse.json({ error: "Tailored file expired — tailor again." }, { status: 404 })
  }

  // ── DOCX download ─────────────────────────────────────────────────────────
  if (fmt === "docx") {
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${name}.docx"`,
      },
    })
  }

  // ── HTML / PDF render ─────────────────────────────────────────────────────
  // Extract the resume's own font so the PDF matches the original look.
  const fonts = await extractDocxFont(buffer)
  const fontStack = `"${fonts.body}", "Calibri", "Segoe UI", Arial, sans-serif`
  const headingStack = fonts.heading !== fonts.body
    ? `"${fonts.heading}", "${fonts.body}", "Calibri", Arial, sans-serif`
    : fontStack

  // mammoth with semantic style mapping so headings come through correctly.
  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Title'] => h1.doc-title:fresh",
      "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
    ],
  })

  const isPdf = fmt === "pdf"
  // Golden Rule #1: the .docx keeps the resume's EXACT format/fonts — it is the
  // real deliverable. This print view is only a simplified text copy, so we make
  // the Word download the hero and never auto-print a re-rendered document.
  const docxUrl = `/api/tailor/file?token=${token}&fmt=docx&name=${encodeURIComponent(name)}`
  const toolbar = isPdf
    ? `<div class="toolbar">
        <a class="primary" href="${docxUrl}">⬇&nbsp;&nbsp;Download Word (.docx)</a>
        <button onclick="window.print()">Print simplified copy</button>
        <span class="tip">The <b>Word file keeps your exact fonts &amp; layout</b>. This page is only a simplified text copy — open the .docx and <b>Save as PDF</b> from Word for a pixel-perfect PDF.</span>
       </div>`
    : ""
  const autoPrint = ""

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── Screen chrome ── */
body{
  font-family:${fontStack};
  font-size:10.5pt;
  line-height:1.4;
  color:#111;
  background:#e5e7eb;
}

/* ── Toolbar (screen only) ── */
.toolbar{
  position:sticky;top:0;z-index:10;
  display:flex;gap:14px;align-items:center;justify-content:center;
  padding:11px 20px;
  background:#111827;color:#f9fafb;
  font-size:13px;
}
.toolbar a.primary{
  font:inherit;font-weight:700;font-size:13px;text-decoration:none;
  cursor:pointer;padding:9px 20px;border-radius:8px;
  background:#0d9488;color:#fff;transition:background .15s;
}
.toolbar a.primary:hover{background:#0f766e}
.toolbar button{
  font:inherit;font-weight:600;font-size:13px;cursor:pointer;
  padding:9px 18px;border-radius:8px;
  background:transparent;color:#e5e7eb;
  border:1px solid rgba(255,255,255,.25);
  transition:background .15s;
}
.toolbar button:hover{background:rgba(255,255,255,.08)}
.toolbar .tip{color:#9ca3af;font-size:12px;max-width:420px}
.toolbar .tip b{color:#d1fae5}

/* ── Paper sheet ── */
.sheet{
  background:#fff;
  max-width:8.27in;
  margin:18px auto 30px;
  padding:0.55in 0.65in;
  box-shadow:0 2px 16px rgba(0,0,0,.12),0 1px 4px rgba(0,0,0,.08);
  min-height:11in;
}

/* ── Resume content typography ── */

/* Name / document title — largest text, centered, no margin above */
.sheet h1,.sheet .doc-title{
  font-family:${headingStack};
  font-size:20pt;
  font-weight:700;
  text-align:center;
  letter-spacing:0.3px;
  margin:0 0 4px;
  line-height:1.2;
}

/* Contact / subtitle line */
.sheet .doc-subtitle,.sheet p:first-of-type{
  text-align:center;
  font-size:9.5pt;
  color:#374151;
  margin-bottom:6px;
}

/* Section headings — uppercase, bold, thin underline */
.sheet h2{
  font-family:${headingStack};
  font-size:10pt;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:1px;
  border-bottom:1.5px solid #111;
  padding-bottom:2px;
  margin:14px 0 5px;
  line-height:1.3;
}

/* Role title / company line */
.sheet h3{
  font-family:${headingStack};
  font-size:10.5pt;
  font-weight:700;
  margin:9px 0 2px;
  line-height:1.3;
}

/* Body paragraphs */
.sheet p{
  font-size:10pt;
  margin:2px 0 5px;
  line-height:1.45;
}

/* Bullet lists */
.sheet ul,.sheet ol{
  margin:3px 0 7px;
  padding-left:20px;
}
.sheet li{
  font-size:10pt;
  line-height:1.45;
  margin:1.5px 0;
}

/* Inline bold / italic */
.sheet strong,.sheet b{font-weight:700}
.sheet em,.sheet i{font-style:italic}

/* Tables (skills / two-column layouts) */
.sheet table{
  width:100%;
  border-collapse:collapse;
  margin:4px 0 8px;
  font-size:10pt;
}
.sheet td,.sheet th{
  padding:2px 8px 2px 0;
  vertical-align:top;
}
.sheet th{font-weight:700}

/* Horizontal rules (some resumes use them as dividers) */
.sheet hr{
  border:0;
  border-top:1px solid #d1d5db;
  margin:10px 0;
}

/* ── Print ── */
@media print{
  body{background:#fff;font-size:10pt}
  .toolbar{display:none}
  .sheet{
    box-shadow:none;
    margin:0;
    max-width:none;
    padding:0.45in 0.55in;
    min-height:auto;
  }
  @page{
    size:letter;
    margin:0.5in;
  }
}
</style>
</head>
<body>
${toolbar}
<div class="sheet">
${bodyHtml || "<p>(Resume content appears here — tailor again if empty)</p>"}
</div>
${autoPrint}
</body>
</html>`

  return new NextResponse(page, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
