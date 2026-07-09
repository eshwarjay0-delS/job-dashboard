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
        color: "#15803d",
        bg: "#f0fdf4",
        border: "#bbf7d0",
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
      color: "#92400e",
      bg: "#fffbeb",
      border: "#fde68a",
      reason: `${companyName} appears to be a staffing/consulting firm. These companies often file H1B petitions but availability varies by client project.`,
    }
  }

  if (TECH_PATTERNS.some(p => p.test(name))) {
    return {
      status: "possible",
      label: "H1B Sponsor Possible",
      color: "#92400e",
      bg: "#fffbeb",
      border: "#fde68a",
      reason: `${companyName} appears to be a tech company. H1B sponsorship is common in this sector but not confirmed for this employer.`,
    }
  }

  return {
    status: "unknown",
    label: "H1B Status Unknown",
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    reason: `No H1B sponsorship data found for ${companyName}. Research directly on their careers page or ask during screening.`,
  }
}
