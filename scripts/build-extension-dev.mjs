// Makes extension-dev/: the extension with the local dashboard (localhost:3000 and :3001) added. The published
// extension never trusts a local page; only this copy, loaded unpacked by a developer, does.
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const src = root + "extension", out = root + "extension-dev"
const LOCAL = ["http://localhost:3000/*", "http://localhost:3001/*"]

rmSync(out, { recursive: true, force: true })
cpSync(src, out, { recursive: true })
const manifest = JSON.parse(readFileSync(src + "/manifest.json", "utf8"))
const bridge = manifest.content_scripts.find(c => c.js.includes("web-bridge.js"))
bridge.matches = [...LOCAL, ...bridge.matches.filter(m => !LOCAL.includes(m))]
manifest.host_permissions = [...LOCAL, ...manifest.host_permissions.filter(m => !LOCAL.includes(m))]
manifest.name += " (dev)"
writeFileSync(out + "/manifest.json", JSON.stringify(manifest, null, 2) + "\n")
console.log("extension-dev/ written: load it unpacked in chrome://extensions, then set the dashboard URL to http://localhost:3000 in Settings.")
