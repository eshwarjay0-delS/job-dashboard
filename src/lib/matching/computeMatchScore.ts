import type { MatchScore, SkillScoreResult, AliasUsed } from '@/types/matching';

export const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'es6', 'es2015', 'ecmascript', 'vanilla js'],
  typescript: ['ts', 'tsx'],
  react: ['reactjs', 'react.js', 'react js', 'react/next'],
  nextjs: ['next.js', 'next js', 'next'],
  nodejs: ['node.js', 'node js', 'node', 'express', 'expressjs'],
  python: ['py', 'python3'],
  kubernetes: ['k8s', 'kube'],
  docker: ['containerization', 'containers'],
  postgresql: ['postgres', 'pg', 'psql'],
  mongodb: ['mongo', 'mongoose'],
  graphql: ['gql'],
  tailwindcss: ['tailwind', 'tailwind css'],
  'aws': ['amazon web services', 'amazon aws', 'ec2', 's3', 'lambda'],
  'gcp': ['google cloud', 'google cloud platform', 'bigquery'],
  azure: ['microsoft azure', 'azure cloud'],
  terraform: ['infrastructure as code', 'iac'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment', 'github actions', 'gitlab ci'],
  git: ['github', 'gitlab', 'bitbucket', 'version control'],
  java: ['jvm', 'java 8', 'java 11', 'java 17'],
  'c++': ['cpp', 'c plus plus'],
  'c#': ['csharp', 'dotnet', '.net'],
  rust: ['rustlang'],
  go: ['golang'],
  ruby: ['ruby on rails', 'rails'],
  php: ['laravel', 'symfony'],
  swift: ['ios', 'swiftui'],
  kotlin: ['android'],
  flutter: ['dart'],
  'machine learning': ['ml', 'deep learning', 'dl', 'ai/ml', 'artificial intelligence'],
  tensorflow: ['tf', 'keras'],
  pytorch: ['torch'],
  pandas: ['dataframes'],
  numpy: ['np'],
  sql: ['mysql', 'sqlite', 'mssql', 'oracle sql', 'pl/sql'],
  redis: ['redis cache', 'redis cluster', 'redis sentinel'],
  elasticsearch: ['elastic', 'elk'],
  kafka: ['apache kafka', 'event streaming'],
  nginx: ['web server', 'reverse proxy'],
  linux: ['unix', 'bash', 'shell scripting', 'bash scripting'],
  ansible: ['configuration management'],
  jenkins: ['ci server'],
  figma: ['design', 'ui design', 'ux design'],
  jira: ['project management', 'atlassian'],
  agile: ['scrum', 'kanban', 'sprint'],
  rest: ['restful', 'rest api', 'http api'],
  apollo: ['apollo client', 'gql'],
  webpack: ['bundler', 'vite', 'rollup'],
  jest: ['testing', 'unit testing', 'mocha', 'vitest'],
  cypress: ['e2e testing', 'end to end testing', 'playwright'],
  storybook: ['component library', 'ui library'],
  vue: ['vuejs', 'vue.js', 'nuxt', 'nuxtjs'],
  angular: ['angularjs', 'ng'],
  svelte: ['sveltekit'],

  // ── Security & Compliance domain (OT Security, AppSec, GRC, SOC) ────────────
  splunk: ['siem', 'splunk siem', 'splunk enterprise'],
  'azure sentinel': ['microsoft sentinel', 'sentinel siem'],
  crowdstrike: ['falcon', 'crowdstrike falcon', 'edr'],
  paloalto: ['palo alto', 'prisma', 'cortex xdr'],
  qualys: ['qualys vmdr', 'vulnerability management'],
  servicenow: ['snow', 'itsm', 'itom', 'itsm platform'],
  'burp suite': ['burp', 'portswigger', 'dast', 'web app scanner'],
  fortify: ['hpe fortify', 'sast', 'static analysis', 'code scanning'],
  snyk: ['sca', 'software composition analysis', 'open source security'],
  dragos: ['ot security', 'ics security', 'industrial cybersecurity'],
  'nerc cip': ['nerc', 'cip compliance', 'critical infrastructure protection'],
  oscp: ['offensive security', 'penetration testing cert'],
  cissp: ['isc2', 'certified information systems security'],
  'owasp top 10': ['owasp', 'web application security', 'owasp top ten'],
  'mitre att&ck': ['mitre attack', 'mitre', 'ttp', 'attack framework'],
  cyberark: ['pam', 'privileged access management', 'vault'],
  netskope: ['casb', 'cloud access security broker', 'sspm'],
  zscaler: ['ztna', 'zero trust', 'zero trust network access'],
  wiz: ['cspm', 'cloud security posture', 'cloud security'],
  defectdojo: ['vulnerability tracking', 'appsec pipeline'],
  'azure aks': ['aks', 'azure kubernetes', 'kubernetes azure'],
  'flowdesigner': ['flow designer', 'servicenow flow', 'automation engine'],
  'script includes': ['gliderecord', 'server-side scripting', 'servicenow scripting'],
};

const EDU_LEVELS: Record<string, number> = {
  phd: 4, doctorate: 4,
  masters: 3, ms: 3, msc: 3, mba: 3,
  bachelors: 2, bs: 2, ba: 2, bsc: 2, 'b.s.': 2, 'b.a.': 2,
  associates: 1, 'a.s.': 1,
};

export function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[^a-z0-9+#./]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractSkillsFromJD(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const canonical of Object.keys(SKILL_ALIASES)) {
    if (lower.includes(canonical)) found.add(canonical);
    for (const alias of SKILL_ALIASES[canonical]) {
      if (lower.includes(alias)) found.add(canonical);
    }
  }
  const techWords = lower.match(/\b(react|python|java|go|rust|ruby|php|swift|kotlin|flutter|sql|css|html|sass|less|webpack|vite|redux|graphql|grpc|rest|api|aws|gcp|azure|docker|kubernetes|terraform|ansible|jenkins|nginx|linux|git|jira|figma)\b/g);
  if (techWords) techWords.forEach(w => found.add(w));
  return Array.from(found);
}

export function computeSkillsScore(
  userSkills: string[],
  jdSkills: string[]
): SkillScoreResult {
  if (!jdSkills.length) return { score: 70, matchedSkills: [], missingSkills: [], aliasesUsed: [] };
  const normalizedUser = userSkills.map(normalizeSkill);
  const matched: string[] = [];
  const missing: string[] = [];
  const aliasesUsed: AliasUsed[] = [];

  for (const jdSkill of jdSkills) {
    const normJD = normalizeSkill(jdSkill);
    let found = false;
    if (normalizedUser.includes(normJD)) { matched.push(jdSkill); found = true; }
    if (!found) {
      const aliases = SKILL_ALIASES[normJD] || [];
      for (const alias of aliases) {
        if (normalizedUser.includes(alias) || normalizedUser.some(u => u.includes(alias))) {
          matched.push(jdSkill);
          aliasesUsed.push({ canonical: normJD, alias });
          found = true;
          break;
        }
      }
    }
    if (!found) {
      for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        if (aliases.includes(normJD) && (normalizedUser.includes(canonical) || normalizedUser.includes(normJD))) {
          matched.push(jdSkill);
          aliasesUsed.push({ canonical, alias: normJD });
          found = true;
          break;
        }
      }
    }
    if (!found) missing.push(jdSkill);
  }

  const score = Math.round((matched.length / jdSkills.length) * 100);
  return { score, matchedSkills: matched, missingSkills: missing, aliasesUsed };
}

export function computeExperienceScore(userYears: number, requiredYears: number): number {
  if (!requiredYears) return 80;
  if (userYears >= requiredYears) return 100;
  if (userYears >= requiredYears * 0.7) return 80;
  if (userYears >= requiredYears * 0.5) return 60;
  return 30;
}

export function computeEducationScore(userEdu: string, requiredEdu: string): number {
  if (!requiredEdu) return 100;
  const userLevel = EDU_LEVELS[normalizeSkill(userEdu)] ?? 0;
  const reqLevel = EDU_LEVELS[normalizeSkill(requiredEdu)] ?? 0;
  if (userLevel >= reqLevel) return 100;
  if (userLevel === reqLevel - 1) return 70;
  return 40;
}

export function computeLocationScore(userLocation: string, jobLocation: string, workModel?: string): number {
  if (workModel === 'remote') return 100;
  if (!jobLocation || !userLocation) return 80;
  const uLow = userLocation.toLowerCase();
  const jLow = jobLocation.toLowerCase();
  if (jLow.includes('remote') || jLow.includes('anywhere')) return 100;
  const userCity = uLow.split(',')[0].trim();
  const jobCity = jLow.split(',')[0].trim();
  // Compare the CITY tokens directly, not "does the full user string contain
  // the job's city". The old `uLow.includes(jobCity)` false-positived across
  // unrelated cities whose names are substrings — e.g. user "New York, NY"
  // vs job "York, PA" scored a perfect 100. Exact-token match (either side may
  // carry an extra qualifier like "St. Louis City") is correct without that
  // whole-string-substring trap.
  if (jobCity && userCity && (userCity === jobCity || userCity.startsWith(jobCity + ' ') || jobCity.startsWith(userCity + ' '))) return 100;
  const userState = uLow.split(',')[1]?.trim() ?? '';
  const jobState = jLow.split(',')[1]?.trim() ?? '';
  if (userState && jobState && userState.includes(jobState)) return 80;
  return 50;
}

export function getTier(score: number): 'strong' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export interface UserProfile {
  skills?: string[];
  experience_years?: number;
  education?: string;
  location?: string;
}

export function computeMatchScore(profile: UserProfile, job: {
  description?: string;
  skills?: string[];
  experience_years?: number;
  education_level?: string;
  location?: string;
  work_model?: string;
}): MatchScore {
  const jdSkills = job.skills?.length
    ? job.skills.map(normalizeSkill)
    : extractSkillsFromJD(job.description ?? '');

  const skillResult = computeSkillsScore(profile.skills ?? [], jdSkills);
  const expScore = computeExperienceScore(profile.experience_years ?? 0, job.experience_years ?? 0);
  const eduScore = computeEducationScore(profile.education ?? '', job.education_level ?? '');
  const locScore = computeLocationScore(profile.location ?? '', job.location ?? '', job.work_model);

  const overall = Math.round(
    skillResult.score * 0.45 +
    expScore * 0.30 +
    eduScore * 0.15 +
    locScore * 0.10
  );

  return {
    overall,
    tier: getTier(overall),
    skills: skillResult.score,
    experience: expScore,
    education: eduScore,
    location: locScore,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    aliasesUsed: skillResult.aliasesUsed,
  };
}
