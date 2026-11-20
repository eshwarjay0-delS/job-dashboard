// Offline Long answers for the S1 replay. Facts are verbatim lines from the
// eshwarjay05 Houston resume (McKesson, Molina, Valero, Qualcomm). No other profile.

const HOUSTON = [
  "Client: Mckesson - TX Sept 2023 - Present Role: Senior ServiceNow Developer.",
  "Assists with ServiceNow platform incident resolution.",
  "Tracking of Incidents from creation to closure, with timely communication to business.",
  "Monitoring service level agreements (SLAs) and operation level agreements (OLAs).",
  "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation.",
  "Experience in working on the ITIL Process Configuration like Change Management and Knowledge Management and Reporting in ServiceNow.",
  "Expertise in Remedy Force, CMDB, and Change Management end-to-end implementation.",
  "Configuration Management: setting up Configuration Management from scratch defining the CI classes and their relationships.",
  "Provided detailed report of Risk and Compliance overview dashboard of all Business Applications in our organization.",
  "Client: Molina Health Care – Long Beach, CA Dec 2022 - Jul 2023 Role: ServiceNow Developer/Administrator.",
  "Configuration of service portals and configuration and support of GRC and Security Operations-related processes.",
  "Client: Valero Energy, Texas Nov 2018 to Oct 2022 Role: ServiceNow Developer/Analyst.",
  "Created dashboards, reports, and operational analytics to track customer service performance, lending activities, dispute resolution metrics, compliance status, and SLA adherence.",
  "Developed KYC (Know Your Customer) workflows to automate customer verification, compliance reviews, risk assessments, and approval processes.",
  "Implemented role-based access controls, approval workflows, and segregation of duties controls supporting financial regulatory and operational compliance requirements.",
]

export function answerWords(text: string): string[] {
  return String(text || "").match(/[A-Za-z0-9][A-Za-z0-9'+-]*/g) || []
}

/** Length Long: 120–180 words from the Houston resume, never a keyword stub. */
export function longGroundedAnswer(question: string): string {
  const ask = String(question || "").replace(/\s+/g, " ").replace(/[?]+$/g, "").trim()
  const parts = [`I would keep this on the Houston resume when asked about ${ask}.`]
  for (const fact of HOUSTON) {
    if (answerWords(parts.join(" ")).length >= 150) break
    parts.push(fact)
  }
  let text = parts.join(" ")
  while (answerWords(text).length > 180 && parts.length > 2) {
    parts.pop()
    text = parts.join(" ")
  }
  return text.replace(/\s+/g, " ").trim()
}
