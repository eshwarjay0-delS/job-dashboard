/**
 * Recruiter selection.
 *
 * THE THREAT MODEL, live-confirmed 2026-08-31 on a real thread:
 *
 *     from: saanvi@cloudquestit.com      <- middleman (bench-sales, the sender)
 *     to:   abinash.mishra@1rpo.net      <- THE VENDOR (the real client-side recruiter)
 *     cc:   ramvsr94@gmail.com           <- a COMPETING BENCH CANDIDATE
 *           eshwarjay05@gmail.com        <- the user
 *           thilak09912@gmail.com        <- another COMPETING BENCH CANDIDATE
 *
 * The middleman forwards one requisition to several candidates at once and Cc's
 * them all. Those Cc'd freemail addresses are other people competing for the
 * same role. Sending them a tailored resume is the single worst thing this
 * system can do, and it is one careless `reply-all` away at every step.
 *
 * Hence the two structural rules that everything else follows from:
 *   1. The vendor comes from the original **To** line only. The Cc is where the
 *      competitors live, so it is never a source of recipients.
 *   2. Recipients are an ALLOWLIST — an address is positively vouched for or the
 *      job is refused. A freemail *denylist* cannot be the safety mechanism
 *      because it has holes (protonmail.com, comcast.net, a vanity domain), and
 *      each hole is a leak. The denylist only ever NARROWS the vendor set; it is
 *      never what clears an address for sending.
 */

export type AddressClass = "self" | "middleman" | "freemail" | "corporate"

export interface Candidate {
  address: string
  field: "from" | "to" | "cc"
  klass: AddressClass
  selected: boolean
  /** Why this address was NOT chosen. Null when selected. */
  reason: string | null
}

export interface ThreadHeader {
  from: string[]
  to: string[]
  cc: string[]
}

export interface SelectionInput {
  header: ThreadHeader
  /** The user's own address, lowercased. */
  self: string
  /** Domain-label terms, e.g. ["tekblu", "cloudquestit"]. */
  allowlist: string[]
  /** Provider labels, e.g. ["gmail", "yahoo"]. */
  freemail: string[]
  /**
   * Whether to Cc the middleman who forwarded the requisition.
   *
   * Default FALSE (decided 2026-08-31: "to just recruiters without middlemen").
   * With this off the reply goes to the vendor alone and the bench-sales
   * middleman never sees it — a deliberate commercial choice, not an oversight,
   * since they sourced the requisition. Flip to true to keep them in copy.
   */
  ccMiddleman?: boolean
}

export interface Selection {
  ok: boolean
  to: string[]
  cc: string[]
  source: "rule"
  rationale: string
  candidates: Candidate[]
  /** Set when ok === false — the machine-readable refusal reason. */
  haltCode?: string
}

const norm = (s: string) => String(s || "").trim().toLowerCase()
const domainOf = (email: string) => norm(email).split("@")[1] || ""

/**
 * Match a term against a whole DOMAIN LABEL, never as a bare substring of the
 * address. `includes("cloudquestit")` would also match
 * cloudquestit@gmail.com and cloudquestit.attacker.com — both of which would
 * let an impostor be treated as the trusted middleman.
 *
 * A term containing a dot is treated as a full domain (tekblu.us); a bare word
 * matches any label of the domain, so "tekblu" covers tekblu.us AND tekblu.com
 * (live-confirmed: the real domain is tekblu.US, so a hardcoded .com would have
 * matched nothing at all).
 */
export function matchesDomainTerm(email: string, terms: string[]): boolean {
  const dom = domainOf(email)
  if (!dom) return false
  const labels = dom.split(".")
  return terms.some((raw) => {
    const t = norm(raw)
    if (!t) return false
    if (t.includes(".")) return dom === t || dom.endsWith("." + t)
    // A bare term must be the label DIRECTLY BEFORE the TLD — i.e. the
    // registrable name. Matching any label (`labels.includes(t)`) would accept
    // cloudquestit.attacker.com, letting anyone who registers that domain be
    // treated as the trusted middleman and Cc'd on replies carrying a resume.
    // Caught by test 2 on 2026-08-31.
    //   tekblu.us / tekblu.com / mail.tekblu.us -> "tekblu" is labels[-2]  ✓
    //   cloudquestit.attacker.com               -> labels[-2] is "attacker" ✗
    //   cloudquestit@gmail.com                  -> labels[-2] is "gmail"    ✗
    return labels.length >= 2 && labels[labels.length - 2] === t
  })
}

export function isFreemail(email: string, freemail: string[]): boolean {
  return matchesDomainTerm(email, freemail)
}

/**
 * Classify one address. ORDER MATTERS: a middleman operating from a freemail
 * domain must classify as middleman (so it is still Cc'd), not as freemail.
 */
export function classify(email: string, input: SelectionInput): AddressClass {
  const e = norm(email)
  if (e === norm(input.self)) return "self"
  if (matchesDomainTerm(e, input.allowlist)) return "middleman"
  if (isFreemail(e, input.freemail)) return "freemail"
  return "corporate"
}

const RFC_ISH = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/

export function selectRecipients(input: SelectionInput): Selection {
  const { header } = input
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  const add = (address: string, field: "from" | "to" | "cc") => {
    const a = norm(address)
    if (!a || seen.has(a)) return
    seen.add(a)
    candidates.push({ address: a, field, klass: classify(a, input), selected: false, reason: null })
  }
  header.from.forEach((a) => add(a, "from"))
  header.to.forEach((a) => add(a, "to"))
  header.cc.forEach((a) => add(a, "cc"))

  const reasonFor = (c: Candidate): string => {
    switch (c.klass) {
      case "self": return "that's you"
      case "middleman":
        return input.ccMiddleman === true
          ? (c.field === "from" ? "the middleman who sent it — goes in Cc" : "middleman address")
          : (c.field === "from" ? "the middleman who sent it — deliberately not copied" : "middleman address — not copied")
      case "freemail": return "freemail — a competing candidate, never addressed"
      case "corporate": return c.field === "cc" ? "corporate but only in Cc — the vendor is taken from the To line only" : "not selected"
    }
  }

  // ── The vendor: corporate addresses in the ORIGINAL To line, nothing else ──
  const vendors = candidates.filter((c) => c.field === "to" && c.klass === "corporate")

  // The middleman to Cc: prefer the actual sender, fall back to any allowlisted
  // address on the thread.
  const midFrom = candidates.find((c) => c.field === "from" && c.klass === "middleman")
  const midAny = candidates.find((c) => c.klass === "middleman")
  const middleman = midFrom || midAny

  const finish = (haltCode: string, rationale: string): Selection => {
    candidates.forEach((c) => { if (!c.selected) c.reason = reasonFor(c) })
    return { ok: false, to: [], cc: [], source: "rule", rationale, candidates, haltCode }
  }

  if (!middleman) {
    return finish(
      "no_middleman",
      "No tekblu/cloudquestit address on this thread, so there is no middleman to Cc. Refusing rather than guessing who forwarded it.",
    )
  }

  if (vendors.length === 0) {
    const ccCorp = candidates.filter((c) => c.field === "cc" && c.klass === "corporate")
    return finish(
      "no_vendor",
      ccCorp.length
        ? `No corporate address in the original To line. ${ccCorp.length} corporate address(es) sit in Cc (${ccCorp
            .map((c) => c.address)
            .join(", ")}), but Cc is where competing candidates are placed, so it is never promoted to To. Needs a human.`
        : "No corporate address in the original To line after excluding you, the middleman, and freemail. Needs a human.",
    )
  }

  if (vendors.length > 1) {
    return finish(
      "vendor_ambiguous",
      `The original To line holds ${vendors.length} corporate addresses (${vendors
        .map((c) => c.address)
        .join(", ")}). Exactly one vendor is expected, so this is ambiguous — refusing rather than picking.`,
    )
  }

  const ccMiddleman = input.ccMiddleman === true
  const vendor = vendors[0]
  vendor.selected = true
  if (ccMiddleman) middleman.selected = true
  candidates.forEach((c) => { if (!c.selected) c.reason = reasonFor(c) })

  const to = [vendor.address]
  const cc = ccMiddleman ? [middleman.address] : []

  // ── Assertions. Each is a separate check so a failure names itself. ────────
  const all = [...to, ...cc]
  const bad = (code: string, msg: string) => ({
    ok: false, to: [], cc: [], source: "rule" as const, rationale: msg, candidates, haltCode: code,
  })
  if (all.some((a) => !RFC_ISH.test(a))) return bad("malformed_address", `A chosen address is malformed: ${all.join(", ")}.`)
  if (all.some((a) => isFreemail(a, input.freemail))) return bad("freemail_recipient", `A freemail address survived selection (${all.join(", ")}) — refusing, those are competing candidates.`)
  if (all.includes(norm(input.self))) return bad("self_recipient", "Selection includes your own address — refusing.")
  if (to.some((a) => matchesDomainTerm(a, input.allowlist))) return bad("middleman_in_to", "The middleman ended up in To — it belongs in Cc.")
  if (all.length > 6) return bad("too_many_recipients", `${all.length} recipients — refusing above 6.`)

  const dropped = candidates.filter((c) => !c.selected)
  const freemailDropped = dropped.filter((c) => c.klass === "freemail")
  const rationale =
    `Chose ${vendor.address}: the only corporate address in the original To line. ` +
    (ccMiddleman
      ? `Cc'd ${middleman.address}, the ${middleman.field === "from" ? "middleman who sent this" : "middleman on this thread"}.`
      : `Did NOT copy ${middleman.address} — the middleman is deliberately left off, so this goes to the recruiter alone.`) +
    (freemailDropped.length
      ? ` Excluded ${freemailDropped.length} freemail address(es) (${freemailDropped.map((c) => c.address).join(", ")}) — on these threads those are candidates competing for the same role.`
      : "") +
    (dropped.some((c) => c.klass === "self") ? " Excluded your own address." : "")

  return { ok: true, to, cc, source: "rule", rationale, candidates }
}
