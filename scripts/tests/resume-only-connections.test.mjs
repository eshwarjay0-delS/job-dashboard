import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("resume-only sidebar exposes Resume and Connections with WhatsApp but not Jobs or Kompas", () => {
  const src = read("src/app/dashboard/sidebar-nav.tsx")
  assert.match(src, /const RESUME_ONLY_TABS = \[/)
  assert.match(src, /NAV_TABS\.filter\(tab => tab\.href === "\/dashboard\/resume"\)/)
  assert.match(src, /label: "Connections"/)
  assert.match(src, /items: \[navItem\("\/dashboard\/whatsapp"\)\]/)
  assert.match(src, /resumeOnly \? RESUME_ONLY_TABS : NAV_TABS/)
  assert.doesNotMatch(src.split("const RESUME_ONLY_TABS = [")[1].split("const ALL_HREFS")[0], /\/dashboard\/kompas|\/dashboard\/mail/)
})

test("all resume-only subscription users get the dedicated WhatsApp Connections view", () => {
  const entitlement = read("src/lib/resumeOnlyEntitlement.ts")
  const layout = read("src/app/dashboard/layout.tsx")
  const connections = read("src/app/dashboard/connections/page.tsx")
  const home = read("src/app/dashboard/page.tsx")
  assert.match(entitlement, /subscription_accounts/)
  assert.match(entitlement, /isResumeOnlyPlan/)
  assert.match(layout, /await isResumeOnlyAccount\(user\)/)
  assert.match(connections, /await isResumeOnlyAccount\(user\)/)
  assert.match(home, /await isResumeOnlyAccount\(user\)/)
  assert.match(connections, /<LinkCard bot=\{live \? digits : ""\} \/>/)
  assert.doesNotMatch(connections, /connectGmail/)
})

test("WhatsApp linking stays authenticated and normal Connections link to it", () => {
  const api = read("src/app/api/whatsapp/link/route.ts")
  const connections = read("src/app/dashboard/connections/ConnectionsClient.tsx")
  const who = read("src/lib/whatsapp-who.ts")
  assert.match(api, /authenticatedUserId\(request\)/)
  assert.match(connections, /href="\/dashboard\/whatsapp"/)
  assert.match(who, /linkedUserIdChecked\(from\)/)
  assert.match(who, /identity_resolve_whatsapp_user/)
})
