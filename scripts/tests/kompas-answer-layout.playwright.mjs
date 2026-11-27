import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const cssDir = join(here, "../../public/kompas")
const chrome = ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => existsSync(p))

test("the answer line stays wider than 250px at 360, 900, and 1280", async (t) => {
  if (!chrome) { t.skip("chrome is not installed"); return }
  const { chromium } = await import("playwright-core")
  const dir = mkdtempSync(join(tmpdir(), "kompas-layout-"))
  const htmlPath = join(dir, "layout.html")
  writeFileSync(htmlPath, `<!doctype html>
<html><head>
<link rel="stylesheet" href="file://${cssDir}/styles.css">
<link rel="stylesheet" href="file://${cssDir}/answer-aside.css">
</head><body>
<section id="view-copilot" class="view-copilot">
  <div class="overlay bridge-open" id="overlay">
    <main class="content">
      <div class="card" id="card">
        <div class="a">
          <ul id="answer"><li>I started at Qualcomm supporting security operations across the plants and I kept the work on the tools the resume already names.</li></ul>
        </div>
      </div>
    </main>
    <aside id="answerAside" class="answer-aside"><h3>Say this</h3><ul><li>Yeah, so in my last role.</li><li>Configured machine learning and predictive intelligence to search for potential vulnerabilities.</li></ul></aside>
  </div>
</section>
</body></html>`)
  const browser = await chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  try {
    const page = await browser.newPage()
    for (const width of [360, 900, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto("file://" + htmlPath)
      const box = await page.locator("#answer").boundingBox()
      const aside = await page.locator("#answerAside").boundingBox()
      assert.ok(box && box.width > 250, width + "px answer width " + (box && box.width))
      if (width <= 1100) {
        assert.ok(aside && aside.y >= box.y + box.height - 1, width + "px Say this must sit below the answer")
      } else {
        const overlay = await page.locator("#overlay").boundingBox()
        assert.ok(overlay && box.width >= overlay.width * 0.6, width + "px answer keeps 60% width")
        assert.ok(aside && box.x + box.width <= aside.x + 1, width + "px Say this must not cover the answer")
      }
    }
  } finally {
    await browser.close()
  }
})
