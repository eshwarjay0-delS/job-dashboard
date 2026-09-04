// Ground-truth test of recruiter selection, using the REAL thread read from
// eshwarjay05@gmail.com on 2026-08-31.
//
// Run:  node scripts/test-recruiter-selection.js
//
// Compiles src/lib/auto-reply/recruiter.ts to a temp dir and asserts the
// selection rules against the REAL thread observed on 2026-08-31. These are
// safety assertions, not style checks: a failure here means the loop could
// address the wrong person with the user's resume.
const { execSync } = require("child_process");
const os = require("os"), fs = require("fs"), nodePath = require("path");

const out = fs.mkdtempSync(nodePath.join(os.tmpdir(), "recruiter-test-"));
// execSync goes through the shell, so this resolves npx on Windows and POSIX alike.
execSync(`npx tsc src/lib/auto-reply/recruiter.ts --outDir "${out}" --module commonjs --target es2020 --skipLibCheck`,
  { stdio: "inherit" });
const { selectRecipients, classify, matchesDomainTerm } = require(nodePath.join(out, "recruiter.js"));

const FREEMAIL = ["gmail","googlemail","yahoo","ymail","outlook","hotmail","live","msn","icloud","me","mac","aol","proton","protonmail","gmx","comcast","att","verizon","sbcglobal","cox"];
const ALLOW = ["tekblu", "cloudquestit"];
const SELF = "eshwarjay05@gmail.com";

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}`);
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
};

console.log("\n1) THE REAL THREAD (ground truth)");
const real = selectRecipients({
  header: {
    from: ["saanvi@cloudquestit.com"],
    to:   ["abinash.mishra@1rpo.net"],
    cc:   ["ramvsr94@gmail.com", "eshwarjay05@gmail.com", "thilak09912@gmail.com"],
  },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL,
});
check("resolves", real.ok, true);
check("To = the vendor", real.to, ["abinash.mishra@1rpo.net"]);
check("Cc is EMPTY - middleman not copied (default)", real.cc, []);
check("only the vendor is addressed", real.candidates.filter(c=>c.selected).map(c=>c.address), ["abinash.mishra@1rpo.net"]);
check("middleman is NOT an addressee", real.to.concat(real.cc).includes("saanvi@cloudquestit.com"), false);
console.log("  rationale:", real.rationale);

console.log("\n1b) SAME THREAD with ccMiddleman: true (opt-in)");
const withCc = selectRecipients({
  header: {
    from: ["saanvi@cloudquestit.com"],
    to:   ["abinash.mishra@1rpo.net"],
    cc:   ["ramvsr94@gmail.com", "eshwarjay05@gmail.com", "thilak09912@gmail.com"],
  },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL, ccMiddleman: true,
});
check("To unchanged", withCc.to, ["abinash.mishra@1rpo.net"]);
check("Cc = middleman only", withCc.cc, ["saanvi@cloudquestit.com"]);
check("still no competing candidates", withCc.to.concat(withCc.cc).filter(a=>a.endsWith("@gmail.com")), []);

console.log("\n2) DOMAIN MATCHING (tekblu is .us, not .com)");
check("tekblu.us matches", matchesDomainTerm("maya@tekblu.us", ALLOW), true);
check("tekblu.com matches", matchesDomainTerm("x@tekblu.com", ALLOW), true);
check("cloudquestit@gmail.com does NOT", matchesDomainTerm("cloudquestit@gmail.com", ALLOW), false);
check("cloudquestit.attacker.com does NOT", matchesDomainTerm("x@cloudquestit.attacker.com", ALLOW), false);
check("sub.tekblu.us matches", matchesDomainTerm("x@mail.tekblu.us", ALLOW), true);

console.log("\n3) CLASSIFICATION ORDER");
const inp = { header:{from:[],to:[],cc:[]}, self: SELF, allowlist: ALLOW, freemail: FREEMAIL };
check("self wins", classify(SELF, inp), "self");
check("middleman beats freemail", classify("x@cloudquestit.com", inp), "middleman");
check("freemail", classify("rando@gmail.com", inp), "freemail");
check("corporate", classify("v@1rpo.net", inp), "corporate");

console.log("\n4) REFUSALS (must fail closed, never guess)");
const noVendor = selectRecipients({
  header:{ from:["saanvi@cloudquestit.com"], to:[], cc:["a@gmail.com", SELF] },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL });
check("no vendor -> refuse", noVendor.ok, false);
check("no vendor -> code", noVendor.haltCode, "no_vendor");

const ccOnlyCorp = selectRecipients({
  header:{ from:["saanvi@cloudquestit.com"], to:[], cc:["vendor@acme.com", SELF] },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL });
check("corporate in Cc is NOT promoted to To", ccOnlyCorp.ok, false);

const two = selectRecipients({
  header:{ from:["saanvi@cloudquestit.com"], to:["a@acme.com","b@beta.com"], cc:[SELF] },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL });
check("two vendors -> ambiguous", two.haltCode, "vendor_ambiguous");

const noMid = selectRecipients({
  header:{ from:["someone@random.com"], to:["v@acme.com"], cc:[SELF] },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL });
check("no middleman -> refuse", noMid.haltCode, "no_middleman");

console.log("\n5) THE LEAK CASE — a competing candidate on a NON-freemail domain");
const vanity = selectRecipients({
  header:{ from:["saanvi@cloudquestit.com"], to:["abinash.mishra@1rpo.net"],
           cc:["rival@rivalconsulting.com", SELF] },
  self: SELF, allowlist: ALLOW, freemail: FREEMAIL });
// The rival is corporate-looking, so the freemail denylist can NOT catch it.
// What protects the user is that Cc is never a source of recipients at all.
check("vanity-domain rival is never addressed", vanity.to.concat(vanity.cc).includes("rival@rivalconsulting.com"), false);
check("...and the vendor is still chosen from To", vanity.to, ["abinash.mishra@1rpo.net"]);
check("...with nobody copied", vanity.cc, []);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
