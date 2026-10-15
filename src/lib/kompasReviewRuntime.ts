// The original perfACT zero-model rules, executed unchanged from the
// self-hosted source snapshots. This avoids drift between UI measurements
// and the server endpoints. Never evaluate untrusted request data as code.
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createContext, runInContext } from "node:vm"

type Fn = (...args: never[]) => unknown
export type LegacyModule = Record<string, unknown>
export type LegacyRuntime = {
  pace: LegacyModule
  score: LegacyModule
  review: LegacyModule
  lexicon: LegacyModule
  lexiconData: LegacyModule
}

let pending: Promise<LegacyRuntime> | undefined
export function kompasReviewRuntime(): Promise<LegacyRuntime> {
  if (!pending) pending = (async () => {
    const context = createContext({})
    const root = join(process.cwd(), "public", "kompas")
    const files = [
      "pace-core.js",
      "score-core.js",
      "review-core.js",
      "lexicon-data.js",
      "lexicon-core.js",
    ]
    for (const file of files) {
      const source = await readFile(join(root, file), "utf8")
      runInContext(source, context, { filename: "kompas/" + file, timeout: 3000 })
    }
    const g = context as unknown as Record<string, unknown>
    for (const name of ["KompasPace", "KompasScore", "KompasReviewCore", "KompasLexicon", "KompasLexiconData"]) {
      if (!g[name] || typeof g[name] !== "object") throw new Error("Missing original Kompas core " + name)
    }
    return {
      pace: g.KompasPace as LegacyModule,
      score: g.KompasScore as LegacyModule,
      review: g.KompasReviewCore as LegacyModule,
      lexicon: g.KompasLexicon as LegacyModule,
      lexiconData: g.KompasLexiconData as LegacyModule,
    }
  })().catch((err: unknown) => { pending = undefined; throw err })
  return pending
}
export function coreCall<T = unknown>(module: LegacyModule, name: string, ...args: unknown[]): T {
  const f = module[name]
  if (typeof f !== "function") throw new Error("Missing original Kompas operation: " + name)
  return (f as Fn)(...args as never[]) as T
}
