// Run with: node generate-icons.js
// Generates icon PNGs from the SVG using sharp (if installed) or canvas.
// Install: npm install sharp
// Then: node extension/generate-icons.js

const fs = require("fs")
const path = require("path")

async function main() {
  let sharp
  try { sharp = require("sharp") } catch {
    console.log("sharp not installed. Run: npm install sharp")
    console.log("Then rerun: node extension/generate-icons.js")
    process.exit(1)
  }

  const svgPath = path.join(__dirname, "icons", "icon.svg")
  const svg = fs.readFileSync(svgPath)

  for (const size of [16, 48, 128]) {
    const outPath = path.join(__dirname, "icons", `icon${size}.png`)
    await sharp(svg).resize(size, size).png().toFile(outPath)
    console.log(`✓ Generated icon${size}.png`)
  }
  console.log("\nAll icons generated. Load the extension in Chrome:")
  console.log("  chrome://extensions → Developer mode → Load unpacked → select the extension/ folder")
}

main()
