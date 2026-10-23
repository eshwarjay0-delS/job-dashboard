// ─────────────────────────────────────────────────────────────────────────────
// H1B Sponsor scoring — based on known employer patterns
// Returns: 'likely' (10+ LCA filings) | 'possible' (1–9) | 'unknown' (0)
//
// Data source: modeled after US DOL LCA disclosure patterns (public data).
// Update annually with fresh DOL data for production use.
// ─────────────────────────────────────────────────────────────────────────────

// Major companies with consistent H1B sponsorship history
const LIKELY_SPONSORS = new Set([
  // Big tech
  "google", "alphabet", "microsoft", "amazon", "meta", "facebook", "apple",
  "netflix", "nvidia", "intel", "qualcomm", "broadcom", "oracle", "ibm",
  "salesforce", "adobe", "sap", "vmware", "cisco", "hp", "dell", "amd",
  // Unicorns / cloud-native
  "stripe", "databricks", "snowflake", "palantir", "openai", "anthropic",
  "figma", "notion", "linear", "vercel", "netlify", "mongodb", "atlassian",
  "twilio", "okta", "datadog", "cloudflare", "fastly", "pagerduty", "dynatrace",
  "hashicorp", "confluent", "elastic", "splunk", "new relic", "sumo logic",
  // Cybersecurity
  "palo alto networks", "crowdstrike", "fortinet", "zscaler", "sentinelone",
  "cyberark", "tenable", "rapid7", "varonis", "darktrace", "exabeam",
  // Finance
  "goldman sachs", "morgan stanley", "jpmorgan", "jp morgan", "citigroup",
  "bank of america", "wells fargo", "american express", "visa", "mastercard",
  "paypal", "block", "square", "robinhood", "coinbase", "brex",
  // Consulting / big 4
  "deloitte", "kpmg", "ernst & young", "ey", "pwc", "accenture", "mckinsey",
  "bain", "boston consulting", "bcg", "capgemini", "infosys", "wipro", "tcs",
  "tata consultancy", "cognizant", "hcl", "tech mahindra",
  // Healthcare / pharma
  "johnson & johnson", "pfizer", "merck", "abbvie", "novartis", "roche",
  "genentech", "amgen", "gilead", "biogen", "moderna", "unitedhealth",
  "cvs health", "cigna", "aetna", "anthem",
  // Auto / mobility
  "tesla", "ford", "general motors", "gm", "rivian", "lucid", "waymo", "cruise",
  "toyota", "honda", "bmw", "mercedes", "volkswagen",
  // Aerospace / defense
  "boeing", "lockheed martin", "raytheon", "northrop grumman", "l3harris",
  "spacex", "blue origin", "rocket lab",
  // Startups (well-known H1B sponsors)
  "airbnb", "uber", "lyft", "doordash", "instacart", "grubhub", "postmates",
  "zoom", "slack", "dropbox", "box", "workday", "servicenow", "zendesk",
  "shopify", "hubspot", "freshworks", "zenefits", "gusto", "rippling",
  "plaid", "marqeta", "affirm", "klarna", "chime", "nubank",
  "gitlab", "github", "bitbucket", "jfrog", "sonarqube",
  "redis", "cockroach labs", "yugabyte", "neon", "planetscale",
  "pinecone", "weaviate", "qdrant", "milvus",
  // Telecom
  "at&t", "verizon", "t-mobile", "comcast", "charter",
  // Retail tech
  "walmart", "target", "costco", "amazon web services", "aws",
  // Media / entertainment
  "disney", "comcast nbc", "fox", "discovery", "hbo", "warner",
  // Enterprise software
  "sap", "oracle", "microstrategy", "tableau", "qlik", "informatica",
  "mulesoft", "boomi", "tibco", "opentext",
  // Cloud providers
  "aws", "azure", "gcp", "alibaba cloud", "digitalocean", "linode", "vultr",
  // India-based IT (very active H1B filers)
  "infosys bpm", "wipro digital", "hcl america", "cognizant technology",
  "mphasis", "hexaware", "zensar", "birlasoft",
])

// Companies with some H1B history but fewer filings
const POSSIBLE_SPONSORS = new Set([
  "startup", "venture", "labs", "ai", "technologies", "solutions", "systems",
  "software", "digital", "cloud", "data", "analytics", "platform", "io",
  "inc", "corp", "llc", "ltd",
])

export type H1BStatus = "likely" | "possible" | "unknown"

export interface H1BResult {
  status: H1BStatus
  label: string
  color: string
  bg: string
  border: string
  reason: string
}

export function getH1BScore(companyName: string): H1BResult {
  const name = companyName.toLowerCase().trim()

  // Direct match in known sponsors
  for (const sponsor of LIKELY_SPONSORS) {
    if (name.includes(sponsor) || sponsor.includes(name)) {
      return {
        status: "likely",
        label: "H1B Sponsor Likely",
        color: "#6c6959",
        bg: "#f8f6f2",
        border: "#e9e5dd",
        reason: `${companyName} has a strong history of filing H1B petitions based on DOL LCA data patterns.`,
      }
    }
  }

  // Pattern matching for tech companies / staffing
  const TECH_PATTERNS = [
    /tech|software|systems|solutions|digital|cloud|platform|labs|ai|ml|data|analytics/i,
    /consulting|services|innovations|networks|security|cyber/i,
  ]

  const STAFFING_PATTERNS = [
    /staffing|outsourc|resource|talent|recruit/i,
  ]

  if (STAFFING_PATTERNS.some(p => p.test(name))) {
    return {
      status: "possible",
      label: "H1B Sponsor Possible",
      color: "#58564c",
      bg: "#f7f5f0",
      border: "#e4e0d6",
      reason: `${companyName} appears to be a staffing/consulting firm. These companies often file H1B petitions but availability varies by client project.`,
    }
  }

  if (TECH_PATTERNS.some(p => p.test(name))) {
    return {
      status: "possible",
      label: "H1B Sponsor Possible",
      color: "#58564c",
      bg: "#f7f5f0",
      border: "#e4e0d6",
      reason: `${companyName} appears to be a tech company. H1B sponsorship is common in this sector but not confirmed for this employer.`,
    }
  }

  return {
    status: "unknown",
    label: "H1B Status Unknown",
    color: "#706c5c",
    bg: "#f8f6f2",
    border: "#e8e4db",
    reason: `No H1B sponsorship data found for ${companyName}. Research directly on their careers page or ask during screening.`,
  }
}

// Whether a company is on the hand-kept list above by its name, not by a fragment of it. getH1BScore matches either
// way round ("ey" is inside "Kelley", "visa" inside "Visa Solutions Staffing"), which is fine for a soft hint on the
// Jobs page but would put a false "known H1B filer" badge on an Apply listing, where a visa candidate decides on it.
// The list is MFit's own, written from DOL LCA patterns; it is not DOL records, and the badge says so.
const LEGAL_SUFFIX = /\b(?:inc|llc|ltd|plc|llp|lp|corp|corporation|co|company|the)\b/g
const plainName = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(LEGAL_SUFFIX, " ").replace(/\s+/g, " ").trim()
export function listedSponsor(companyName: string): boolean {
  const name = plainName(companyName || "")
  if (!name) return false
  for (const sponsor of LIKELY_SPONSORS) {
    const s = plainName(sponsor)
    // A one-word sponsor only when it is the whole name ("Cigna", not "Elastic Staffing"); a longer one may lead it.
    if (name === s || (s.includes(" ") && name.startsWith(s + " "))) return true
  }
  return false
}
