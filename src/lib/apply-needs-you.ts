// Needs-you tab for Apply (Tsenta tracker borrow, observed 23 Oct 2026:
// their tracker has tabs All, In flight, Needs you, Failed, Skipped).
// This slice adds only the Needs-you view, derived from the pipeline the
// Apply page already builds from /api/apply/activity events. No new data
// is collected, nothing is sent, and no job is ever marked submitted
// without the user's tap. Submitted jobs are never needs-you: they are
// done, and they leave this list the moment the submitted event lands,
// because the list is recomputed from the same events state.

export type ApplyStage = 'save' | 'view' | 'tailor' | 'open_portal' | 'submitted'

export type PipelineJob = {
  title: string
  company: string
  url: string
  stage: ApplyStage
  at: number
  location?: string
}

export type NeedsYouAction = 'open-portal' | 'mark-submitted'

export type NeedsYouItem = PipelineJob & {
  what: string
  doNext: string
  actionLabel: string
  action: NeedsYouAction
}

const STAGE_LABEL: Record<ApplyStage, string> = {
  save: 'Saved',
  view: 'Viewed',
  tailor: 'Tailored',
  open_portal: 'Portal opened',
  submitted: 'Submitted',
}

export function stageLabel(stage: ApplyStage): string {
  return STAGE_LABEL[stage]
}

// What the user already did, in plain words. No deadline is invented:
// a pipeline row carries no deadline, so none is shown.
export function whatFor(stage: ApplyStage, title: string): string {
  switch (stage) {
    case 'save':
      return `You saved ${title}.`
    case 'view':
      return `You opened ${title} but did not apply yet.`
    case 'tailor':
      return `Your resume is tailored for ${title}, but it has not been submitted.`
    case 'open_portal':
      return `You opened the portal for ${title} and have not confirmed a submission.`
    case 'submitted':
      return `${title} is submitted.`
  }
}

// The one next step for the stage, and its verb-plus-outcome label.
// open_portal is the only stage whose next step is a confirmation,
// because the portal visit already happened and only the answer is
// outstanding. Every other unfinished stage still needs the portal visit.
export function nextActionFor(stage: ApplyStage): { doNext: string; actionLabel: string; action: NeedsYouAction } {
  switch (stage) {
    case 'save':
      return { doNext: 'Open the portal and apply.', actionLabel: 'Open portal', action: 'open-portal' }
    case 'view':
      return { doNext: 'Open the portal and apply.', actionLabel: 'Open portal', action: 'open-portal' }
    case 'tailor':
      return { doNext: 'Apply on the portal with the tailored resume.', actionLabel: 'Apply on portal', action: 'open-portal' }
    case 'open_portal':
      return { doNext: 'Confirm whether you submitted, so this stops needing you.', actionLabel: 'Mark as submitted', action: 'mark-submitted' }
    case 'submitted':
      return { doNext: 'Nothing to do.', actionLabel: 'Submitted', action: 'mark-submitted' }
  }
}

// Needs-you is exactly the pipeline minus submitted jobs, most recent
// first. Rows without a URL cannot be opened or confirmed, so they are
// left out rather than shown as dead cards.
export function needsYou(pipeline: PipelineJob[]): NeedsYouItem[] {
  return pipeline
    .filter((p) => p.stage !== 'submitted' && Boolean(p.url))
    .sort((a, b) => b.at - a.at)
    .map((p) => {
      const next = nextActionFor(p.stage)
      return { ...p, what: whatFor(p.stage, p.title), doNext: next.doNext, actionLabel: next.actionLabel, action: next.action }
    })
}
