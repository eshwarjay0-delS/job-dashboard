import { Card, Meta } from "../_suite/ui"
import PageIntro from "../_components/page-intro"

// This page only gets the extension into Chrome. It is not on the Chrome Web Store, so it is installed
// unpacked, and every step says exactly what to press.
const ZIP = "/extension/marketfit-extension.zip"

const STEPS = [
  "Press Download below. A file called marketfit-extension.zip is saved.",
  "Unzip it. You get a folder.",
  "In Chrome, open chrome://extensions and turn on Developer mode, top right.",
  "Press Load unpacked and pick that folder.",
  "Open any job application. Press the MarketFit button on the page to fill the form.",
]

export default function ExtensionPage() {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <PageIntro page="/dashboard/extension" action={{ label: "How to add it", href: "#install" }} />

      <Card id="install" style={{ scrollMarginTop: 24, display: "flex", flexDirection: "column" }}>
        <Meta>Add it to Chrome</Meta>
        <ol className="mf-steps" style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--text)", marginTop: 12 }}>
          {STEPS.map((s, i) => (
            <li key={i} className="mf-step">
              <span className="mf-step-dot" aria-hidden>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <a href={ZIP} download className="btn-accent"
          style={{ minHeight: 46, padding: "0 22px", fontSize: 15, textDecoration: "none", marginTop: 16, alignSelf: "flex-start" }}>
          Download the extension
        </a>
      </Card>

      <Card>
        <Meta>What it does</Meta>
        <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" }}>
          It fills your name, email, phone and links on job forms from your MarketFit resume, on Greenhouse, Lever,
          Workday and most other job sites. On a job post it can also fit your resume to that job. You check every
          form before you send it.
        </p>
      </Card>
    </div>
  )
}
