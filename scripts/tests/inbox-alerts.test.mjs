// Inbox alerts: urgent mail taps the user, connected to its chain.
// Made-up mail only — no real people, companies or emails.
import { test } from "node:test"
import assert from "node:assert/strict"
import { shapeInboxAlerts } from "../../src/lib/inbox-alerts.ts"

const ME = "me@example.com"
const NOW = Date.UTC(2026, 9, 21, 13, 0, 0)
const MIN = 60_000

const msg = (over = {}) => ({
  id: "m1",
  fromName: "Rita Vale",
  fromEmail: "rita@vendorone.example",
  isMe: false,
  subject: "Senior Cybersecurity and Compliance Engineer",
  category: "Interview Request",
  at: NOW,
  jobTitle: "Senior Cybersecurity and Compliance Engineer",
  company: "Northpier",
  ...over,
})
const thread = (id, messages, accountEmail = ME) => ({ threadId: id, accountEmail, messages })

test("a confirmed interview invite alerts, as a new chain when nothing matches", () => {
  const out = shapeInboxAlerts([thread("t1", [msg({ confirmedInvite: true, meetingStart: NOW + 6 * 60 * MIN })])], [], NOW - MIN)
  assert.equal(out.length, 1)
  assert.equal(out[0].kind, "interview")
  assert.equal(out[0].meetingStart, NOW + 6 * 60 * MIN)
  assert.equal(out[0].connect.state, "new")
})

test("a request-only interview ask never alerts — evidence bar holds", () => {
  const out = shapeInboxAlerts([thread("t1", [msg({ confirmedInvite: false })])], [], NOW - MIN)
  assert.equal(out.length, 0)
  const out2 = shapeInboxAlerts([thread("t1", [msg({})])], [], NOW - MIN)
  assert.equal(out2.length, 0)
})

test("RTR, rate, document and offer categories alert; own mail and old mail do not", () => {
  const threads = [
    thread("t1", [msg({ id: "a", category: "RTR Request" })]),
    thread("t2", [msg({ id: "b", category: "Rate Confirmation" })]),
    thread("t3", [msg({ id: "c", category: "Document Request" })]),
    thread("t4", [msg({ id: "d", category: "Offer" })]),
    thread("t5", [msg({ id: "e", category: "RTR Request", isMe: true })]),
    thread("t6", [msg({ id: "f", category: "RTR Request", at: NOW - 10 * MIN })]),
    thread("t7", [msg({ id: "g", category: "Submission Confirmation" })]),
  ]
  const out = shapeInboxAlerts(threads, [], NOW - MIN)
  assert.deepEqual(out.map(a => a.kind).sort(), ["documents", "offer", "rate", "rtr"])
})

test("an invite on a different thread matching an existing chain by client + role is flagged check-chain", () => {
  // The double-submit pattern: same client, same role, different thread,
  // different req trail. The alert must name the existing chain's people.
  const chains = [
    {
      threadIds: ["t-chain"],
      company: "Northpier",
      role: "Senior Cybersecurity and Compliance Engineer",
      holder: "Generis-style Vendor",
      people: ["Aman Example", "Martin Example"],
    },
  ]
  const inviteThread = thread("t-invite", [
    msg({ id: "inv", confirmedInvite: true, meetingStart: NOW + 60 * MIN }),
  ])
  const ownChain = { threadIds: ["t-invite"], company: "Northpier", role: "Senior Cybersecurity and Compliance Engineer", holder: "Rita Vale", people: ["Rita Vale"] }
  const out = shapeInboxAlerts([inviteThread], [...chains, ownChain], NOW - MIN)
  assert.equal(out.length, 1)
  assert.equal(out[0].connect.state, "check-chain")
  assert.match(out[0].connect.note, /Aman Example/)
  assert.match(out[0].connect.note, /different thread/)
})

test("an alert inside a linked multi-thread chain names the chain and its holder", () => {
  const chains = [
    {
      threadIds: ["t-old", "t-new"],
      company: "Northpier",
      role: "Security Engineer",
      holder: "Priya at VendorTwo",
      people: ["Priya"],
    },
  ]
  const out = shapeInboxAlerts(
    [thread("t-new", [msg({ id: "x", category: "Rate Confirmation", jobTitle: "Security Engineer" })])],
    chains,
    NOW - MIN,
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].connect.state, "chain")
  assert.match(out[0].connect.note, /Priya at VendorTwo/)
})

test("same client but a different role does not trip the second-chain flag", () => {
  const chains = [
    { threadIds: ["t-chain"], company: "Northpier", role: "Network Engineer", holder: "Vendor", people: ["Sam"] },
  ]
  const out = shapeInboxAlerts(
    [thread("t-invite", [msg({ id: "inv", confirmedInvite: true })])],
    chains,
    NOW - MIN,
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].connect.state, "new")
})

test("two urgent messages in one thread collapse to one alert per kind, the latest", () => {
  const out = shapeInboxAlerts(
    [thread("t1", [msg({ id: "old", category: "RTR Request", at: NOW - 5 * MIN }), msg({ id: "new", category: "RTR Request", at: NOW })])],
    [],
    NOW - 10 * MIN,
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].id, "t1:new")
})
