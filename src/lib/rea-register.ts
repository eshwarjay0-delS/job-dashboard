export type ReaSession = {
  id: string; title: string; area: 'gmail'|'applications'|'resume'|'kompas'|'platform';
  method: 'Public reference review'|'Source and artifact analysis'|'REA tool attempt';
  state: 'Research mapped'|'Implemented, verification pending'|'Deployed, verification pending'|'Blocked';
  updated: string; request: string; sources: {label:string;url?:string;path?:string}[];
  steps: {label:string;finding:string;status:'Observed'|'Implemented'|'Tested'|'Pending'|'Blocked';evidence:string}[];
  limits: string; next: string; commits: string[];
}
export const REA_SESSIONS: ReaSession[] = [
{"id":"resume-first-person-confirmation-only-2026-11-15","title":"Reject non-first-person and label-only resume evidence","area":"resume","method":"Source and artifact analysis","state":"Implemented, verification pending","updated":"2026-11-15","request":"Only explicit positive first-person candidate assertions may confirm skills. JD requirements, editing instructions, questions, negations, second-person statements and label-only headings must not be promoted into candidate experience.","sources":[{"label":"Owner-authored 6 Nov correction, reiterated 12 Nov","url":"https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6817645128"},{"label":"Evidence parser","path":"src/lib/resume-evidence.ts"},{"label":"Focused regression suite","path":"scripts/tests/resume-confirmation-quality.test.mjs"},{"label":"Canonical master snapshot","url":"https://github.com/eshwarj¶»§q«^