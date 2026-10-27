// Heard strip (owner, 2026-10-26): the Heard line is a live caption, not the
// record — it shows only the freshest phrase, never the whole backlog. The
// drawer holds every line. Runs the REAL heardDraft sliced out of
// public/kompas/app.js so the shipped code is what is tested.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const start = src.indexOf("function heardDraft(");
assert.ok(start > 0, "heardDraft must exist in app.js");
const end = src.indexOf("\n}\n", start);
assert.ok(end > start, "heardDraft must close at column 0");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(start, end + 3) + "\nthis.heardDraft = heardDraft;", ctx);
const { heardDraft } = ctx;

const THEM = (text) => ({ who: "Them", text });

test("a backlog shows only the freshest phrase, never the whole concatenation", () => {
  const lines = [
    THEM("I lost my job when I was a kid."),
    THEM("I got nosebleeds when I was a kid."),
    THEM("At Citi, you list Zscaler troubleshooting experience."),
    THEM("If a desktop application fails under TLS inspection while browser access works, how would you distinguish certificate pinning from trust store differences?"),
  ];
  const out = heardDraft(lines, "", "");
  assert.equal(out, lines[lines.length - 1].text);
  assert.ok(!/nosebleed|lost my job/i.test(out), "the story backlog is not shown");
});

test("one very long phrase is capped with an ellipsis", () => {
  const long = THEM("How would you " + "distinguish certificate pinning, mutual TLS, trust store differences, and protocol incompatibility ".repeat(4) + "without broadly bypassing inspection?");
  const out = heardDraft([long], "", "");
  assert.ok(out.startsWith("…"), "a capped phrase leads with an ellipsis");
  assert.ok(out.length <= 201, `capped at 200 chars plus ellipsis, got ${out.length}`);
});

test("noise and answer-echo lines never reach the caption", () => {
  const out = heardDraft(
    [{ who: "Them", text: "Hello." }, THEM("How did you handle clock drift?")],
    "",
    ""
  );
  assert.equal(out, "How did you handle clock drift?");
  const echo = heardDraft(
    [{ who: "You", text: "At Citi I led the endpoint migration and owned firewall policy cleanup end to end" }],
    "",
    "At Citi I led the endpoint migration. We rolled out CrowdStrike and I owned the firewall policy cleanup end to end."
  );
  assert.equal(echo, "");
});

test("nothing heard means no caption", () => {
  assert.equal(heardDraft([], "", ""), "");
});
