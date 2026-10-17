// Regenerates src/lib/visionDocs.ts from docs/{gmail,apply,resume,kompas}.md.
// Run after editing any vision doc:  node scripts/regenerate-vision-docs.mjs
// The Plan & Vision hub's text/mind-map views read the generated file; the
// Live view reads docs/wishes.md + git log fresh on every request.
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const docs = [
  { product: "gmail", file: "gmail.md", title: "Gmail — Master Vision" },
  { product: "apply", file: "apply.md", title: "Apply — Master Vision" },
  { product: "resume", file: "resume.md", title: "Resume — Master Vision" },
  { product: "kompas", file: "kompas.md", title: "Kompas — Master Vision" },
]

const entries = docs.map(d => {
  const markdown = readFileSync(join(root, "docs", d.file), "utf8")
  return `  { product: ${JSON.stringify(d.product)}, title: ${JSON.stringify(d.title)}, markdown: ${JSON.stringify(markdown)} },`
})

const out = `// Vision docs, generated from docs/*.md. Regenerate with:
//   node scripts/regenerate-vision-docs.mjs
// Single source of truth for the Plan & Vision hub (text view + mind map view).
// The Live view reads docs/wishes.md + git log fresh on every request.

export type VisionDoc = { product: string; title: string; markdown: string }

export const VISION_DOCS: VisionDoc[] = [
${entries.join("\n")}
];
`

writeFileSync(join(root, "src/lib/visionDocs.ts"), out)
console.log(`visionDocs.ts regenerated from ${docs.length} docs`)
