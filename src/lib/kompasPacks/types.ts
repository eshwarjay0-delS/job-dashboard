export type PackKind = "role" | "category"

export type PackProbe = { question: string; answer: string }

export type PackCheck = { item: string; brief: string }

export type KompasPack = {
  id: string
  kind: PackKind
  title: string
  blurb: string
  dossier: string
  mustMention: string[]
  avoid: string[]
  probes: PackProbe[]
  checklist: PackCheck[]
  notebookLmUrl: string
}

export type PackNote = {
  at: number
  question: string
  level: string
  kept: string
  missed: string[]
}

export type PackDepth = {
  design: string
  stories: string[]
  director: string
  terms: string[]
  metrics: string[]
  pitfalls: string[]
}
