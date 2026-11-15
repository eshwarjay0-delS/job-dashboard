/** Versioned handoff log: approval, delivery and verification are independent. */
export type PlanJournalEntry = {
  id: string
  area: 'all' | 'gmail' | 'applications' | 'resume' | 'kompas'
  updated: string
  title: string
  approval: 'approved' | 'proposed' | 'unapproved' | 'rejected'
  delivery: 'planned' | 'in progress' | 'blocked' | 'deployed' | 'superseded'
  detail: string
  evidence: string
  next: string
  commit?: string
}


export const JOURNAL_UPDATED = '2026-11-15T15:25:00Z'
export const PLAN_JOURNAL: PlanJournalEntry[] = [
{"id":"resume-first-person-confirmation-current-master-restack-2026-11-15","area":"resume","updated":"2026-11-15T15:25:00Z","title":"Restack approved first-person confirmation guard onto current master","approval":"approved","delivery":"in progress","detail":"The MFit Safe Merge Gate confirmed the owner's 14 Nov first-person confirmation correction and requested a safe restack of PR #415. The eight-file patch was applied three-way onto canonical master 8ad319d, preserving the merged #416 synthetic fixture privacy additions. Conflicts were resolved by retaining both master and branch requirements: WhatsApp workflow path filters include the new shared resume-evidence parser and its focused test; resume docs and Plan & Vision retain the synthetic-fixture rule and add the first-person positive-evidence boundary. Runtime changes are limited to candidate-evidence parsing; no employer, project, action, outcome, metric, date, credential or other bio¶»§q«^