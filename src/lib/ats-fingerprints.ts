/**
 * ATS fingerprint file — URL pattern → platform detection.
 * Tsenta ships a 45-entry version of this; ours covers the 57-firm portal
 * directory plus general ATS patterns for any job URL we encounter.
 * Used by apply-in-place to pick the right automation path per posting.
 */

export type AtsPlatform =
  | "greenhouse" | "lever" | "workday" | "icims" | "phenom" | "taleo"
  | "successfactors" | "brassring" | "smartrecruiters" | "workable" | "jazzhr"
  | "bamboohr" | "jobvite" | "breezy" | "ashby" | "rippling" | "paylocity"
  | "oracle" | "ultipro" | "dayforce" | "eightfold" | "jobsnet" | "applytojob"
  | "wordpress" | "custom" | "unknown"

// General ATS URL patterns — checked in order. First match wins.
const ATS_PATTERNS: { pattern: RegExp; platform: AtsPlatform }[] = [
  { pattern: /boards\.greenhouse\.io/i, platform: "greenhouse" },
  { pattern: /lever\.co/i, platform: "lever" },
  { pattern: /\.myworkdayjobs\.com/i, platform: "workday" },
  { pattern: /\.icims\.com/i, platform: "icims" },
  { pattern: /\.phenompeople\.com|\.phenom\.com/i, platform: "phenom" },
  { pattern: /\.taleo\.net/i, platform: "taleo" },
  { pattern: /successfactors\./i, platform: "successfactors" },
  { pattern: /\.brassring\.com/i, platform: "brassring" },
  { pattern: /smartrecruiters\.com/i, platform: "smartrecruiters" },
  { pattern: /\.workable\.com/i, platform: "workable" },
  { pattern: /\.jazz\.co|\.jazzhr\.com/i, platform: "jazzhr" },
  { pattern: /\.bamboohr\.com/i, platform: "bamboohr" },
  { pattern: /\.jobvite\.com/i, platform: "jobvite" },
  { pattern: /\.breezy\.hr/i, platform: "breezy" },
  { pattern: /ashbyhq\.com/i, platform: "ashby" },
  { pattern: /\.rippling\.com/i, platform: "rippling" },
  { pattern: /\.paylocity\.com/i, platform: "paylocity" },
  { pattern: /oraclecloud\.com.*recruiting/i, platform: "oracle" },
  { pattern: /\.ultipro\.com|\.ukg\.com/i, platform: "ultipro" },
  { pattern: /\.dayforcehcm\.com/i, platform: "dayforce" },
  { pattern: /\.eightfold\.ai/i, platform: "eightfold" },
  { pattern: /\.jobs\.net/i, platform: "jobsnet" },
  { pattern: /\.applytojob\.com/i, platform: "applytojob" },
  // Staffing-firm custom portals (from the 57-firm directory recon)
  { pattern: /careers\.teksystems\.com/i, platform: "phenom" },      // TEKsystems runs Phenom
  { pattern: /bhsg\.com/i, platform: "wordpress" },                   // Beacon Hill — FacetWP/WordPress (crawled)
  { pattern: /wp-content|wp-json|facetwp/i, platform: "wordpress" },
]

/** Detect the ATS/platform for any job or portal URL. */
export function detectAts(url: string): AtsPlatform {
  if (!url) return "unknown"
  for (const { pattern, platform } of ATS_PATTERNS) {
    if (pattern.test(url)) return platform
  }
  return "custom"
}

// ─── 57-firm portal directory → platform ─────────────────────────────
// Portal URLs verified 2026-10-17. Platform from URL pattern + recon notes.
// "custom" = firm's own job board; "unknown" = portal unverified.
export const FIRM_PLATFORMS: { firm: string; portal: string; platform: AtsPlatform; cyber: boolean }[] = [
  { firm: "TEKsystems", portal: "https://careers.teksystems.com/us/en", platform: "phenom", cyber: true },
  { firm: "Everforth", portal: "https://www.apexsystems.com/search-results-usa/", platform: "custom", cyber: true },
  { firm: "Insight Global", portal: "https://insightglobal.com/jobs/search/all/all", platform: "custom", cyber: true },
  { firm: "Kforce", portal: "https://www.kforce.com/find-work", platform: "custom", cyber: true },
  { firm: "Experis", portal: "", platform: "unknown", cyber: true },
  { firm: "Robert Half Technology", portal: "http://www.roberthalf.com/us/en/find-jobs.html", platform: "custom", cyber: true },
  { firm: "Randstad Digital", portal: "https://www.randstaddigital.com/technology-solutions/rits/job-postings/", platform: "custom", cyber: true },
  { firm: "Akkodis", portal: "", platform: "unknown", cyber: true },
  { firm: "Motion Recruitment", portal: "https://motionrecruitment.com/candidates", platform: "custom", cyber: true },
  { firm: "Collabera", portal: "https://collabera.com/job-search/", platform: "custom", cyber: true },
  { firm: "Beacon Hill Technologies", portal: "https://bhsg.com/jobs/", platform: "wordpress", cyber: true },
  { firm: "Oxford Global Resources", portal: "https://jobs.oxfordcorp.com/disciplines/information-services", platform: "custom", cyber: true },
  { firm: "Eliassen Group", portal: "https://www.eliassen.com/careers", platform: "custom", cyber: true },
  { firm: "Pyramid Consulting", portal: "https://pyramidci.jobs.net", platform: "jobsnet", cyber: true },
  { firm: "Mitchell Martin", portal: "", platform: "unknown", cyber: true },
  { firm: "eTeam", portal: "", platform: "unknown", cyber: true },
  { firm: "System One", portal: "", platform: "unknown", cyber: false },
  { firm: "Addison Group", portal: "https://addisongroup.com/jobs/", platform: "custom", cyber: false },
  { firm: "Brooksource", portal: "https://jobs.brooksource.com", platform: "custom", cyber: true },
  { firm: "INSPYR Solutions", portal: "https://www.inspyrsolutions.com/igsjob-search/", platform: "custom", cyber: false },
  { firm: "SNI Technology", portal: "", platform: "unknown", cyber: true },
  { firm: "The Judge Group", portal: "", platform: "unknown", cyber: false },
  { firm: "KORE1", portal: "https://talent.kore1.com/careers", platform: "custom", cyber: true },
  { firm: "CyberSN", portal: "https://cybersn.com/", platform: "custom", cyber: true },
  { firm: "Kavaliro", portal: "https://jobs.kavaliro.com", platform: "custom", cyber: true },
  { firm: "Genesis10", portal: "https://www.genesis10.com/consultant-careers", platform: "custom", cyber: true },
  { firm: "CSI Companies", portal: "https://www.csicompanies.com/job-search", platform: "custom", cyber: false },
  { firm: "The Fountain Group", portal: "https://www.thefountaingroup.com/index.php/job-seekers", platform: "custom", cyber: true },
  { firm: "IDR", portal: "https://jobs.idr-inc.com/", platform: "custom", cyber: true },
  { firm: "Vaco", portal: "https://jobs.vaco.com", platform: "custom", cyber: false },
  { firm: "Diverse Lynx", portal: "https://www.diverselynx.com/careers/", platform: "custom", cyber: true },
  { firm: "IntelliPro Group", portal: "https://intellipro.applytojob.com", platform: "applytojob", cyber: false },
]

/** Which automation path to use for a posting URL. */
export function automationPath(url: string): "ats-direct" | "portal-custom" | "manual" {
  const platform = detectAts(url)
  // Known ATS platforms with structured apply flows → automate directly
  const atsDirect: AtsPlatform[] = ["greenhouse", "lever", "workday", "icims", "ashby", "smartrecruiters", "workable", "jobsnet", "applytojob"]
  if (atsDirect.includes(platform)) return "ats-direct"
  // Firm custom portals → portal-specific handling
  if (platform === "custom" || platform === "wordpress" || platform === "phenom") return "portal-custom"
  return "manual"
}
