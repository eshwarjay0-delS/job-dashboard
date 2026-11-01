import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Edit-setup-and-continue on session cards (Nov 1): only a session that can
// still be continued (the sessionOpen branch — stopped/open, not live in
// another window) offers setup editing, via its card click and an Edit setup
// button. The wizard is reused in edit mode; Save & continue writes only setup
// fields and then continues through the tested continueSession path.
// Source-marker suite: renderSessions and the wizard are DOM code, so the
// assertions check the wiring text, matching kompas-screen-review.test.mjs.
const appJs = readFileSync("public/kompas/app.js", "utf8")
const indexHtml = readFileSync("public/kompas/index.html", "utf8")
const render = appJs.slice(appJs.indexOf("function renderSessions()"), appJs.indexOf('$("newSessionBtn").onclick'))
const editOpen = appJs.slice(appJs.indexOf("function openEditWizard"), appJs.indexOf("function finishEditWizard"))
const editFinish = appJs.slice(appJs.indexOf("function finishEditWizard"), appJs.indexOf("function gotoStep"))
const finish = appJs.slice(appJs.indexOf("function finishWizard()"), appJs.indexOf("/* ------------------------------- copilot"))
const draftSave = appJs.slice(appJs.indexOf("function saveWizardDraft"), appJs.indexOf("function clearWizardDraft"))
const life = appJs.slice(appJs.indexOf("function sweepSessions()"), appJs.indexOf("// Another window changed the sessions:"))

test("continuable cards carry an Edit setup button", () => {
  assert.ok(render.includes("sc-edit"), "edit button in card template")
  assert.ok(render.includes("Edit setup"), "edit button labelled")
})

test("card click and edit button open the editor only in the continuable branch", () => {
  const branch = render.slice(render.indexOf("stopped; no automatic expiry"), render.indexOf("ended is final"))
  assert.ok(branch.includes("openEditWizard"), "editor wired in the sessionOpen branch")
  assert.ok(branch.includes('closest("button")'), "card click ignores its own buttons")
  assert.equal((render.match(/card\.onclick/g) || []).length, 1, "exactly one card click handler")
  const ended = render.slice(render.indexOf("ended is final"))
  assert.ok(!ended.includes("openEditWizard"), "ended cards offer no editor")
})

test("edit mode pre-fills the wizard from the stored session", () => {
  for (const field of ['$("company").value = stored.company', '$("role").value = stored.role', '$("jd").value = stored.jd', '$("instructions").value = stored.instructions', "selectedResumeId", "selectedDocIds", "editId: stored.id"]) {
    assert.ok(editOpen.includes(field), `openEditWizard sets ${field}`)
  }
})

test("edit finish writes only setup fields, then continues", () => {
  assert.ok(editFinish.includes("sessionOpen(x)"), "continuability re-checked at save time")
  assert.ok(editFinish.includes("liveElsewhere(x)"), "other-window guard at save time")
  assert.ok(editFinish.includes("continueSession(x)"), "continues through the tested path")
  assert.ok(editFinish.includes("x.company ="), "setup field written")
  assert.ok(editFinish.includes("x.instructions ="), "instructions written")
  assert.ok(!/\bx\.(id|createdAt|runAt|pausedAt|transcripts|endedAt|endedBy)\s*=/.test(editFinish), "no lifecycle field written")
})

test("wizard finish branches to the edit path and labels the button", () => {
  assert.ok(finish.includes("draft.editId") && finish.includes("finishEditWizard()"), "finishWizard branches on editId")
  assert.ok(appJs.includes("Save & continue"), "step-2 button relabelled in edit mode")
})

test("editing never pollutes the new-session draft cache", () => {
  assert.ok(draftSave.includes("draft.editId"), "saveWizardDraft guarded on editId")
})

test("cache-bust tag moved with the app.js change", () => {
  assert.ok(indexHtml.includes("app.js?v=20261101-full-question-auth"), "new v tag present")
  assert.ok(!indexHtml.includes("20261101-auth-lock"), "old v tag gone")
})

test("protected lifecycle slice untouched by the edit work", () => {
  assert.ok(life.includes("Respect explicit End"), "continueSession guard comment intact")
  assert.ok(life.includes("launchCopilot(x, { resume: true })"), "continue path intact")
  assert.ok(!life.includes("openEditWizard") && !life.includes("finishEditWizard"), "no edit code in the tested slice")
})
