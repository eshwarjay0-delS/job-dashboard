export type MemoryIntent = "temporal" | "factual" | "episodic" | "constraint" | "causal" | "multimodal";

export interface VersionedMemory {
  id: string;
  key: string;
  text: string;
  confidence: number;
  status: "active" | "superseded" | "disputed" | "retracted";
  validFrom?: string | null;
  validTo?: string | null;
  assertedAt: string;
  explicit?: boolean;
  priority?: number;
}

export interface RetrievalPlan {
  intents: MemoryIntent[];
  lexicalWeight: number;
  semanticWeight: number;
  temporalWeight: number;
  graphDepth: number;
  hierarchyLevels: number[];
  requireConstraints: boolean;
}

const TEMPORAL = /\b(now|current|currently|today|latest|before|after|when|then|previous|used to|at the time)\b/i;
const CAUSAL = /\b(why|because|cause|led to|result|impact|reason)\b/i;
const EPISODIC = /\b(remember|session|interview|conversation|meeting|happened|said|asked)\b/i;
const CONSTRAINT = /\b(should|must|never|avoid|prefer|only|don't|do not|allowed|require|style|tone|depth|role)\b/i;
const MULTIMODAL = /\b(image|photo|screenshot|diagram|audio|video|page|figure|slide)\b/i;

export function classifyMemoryIntent(query: string): MemoryIntent[] {
  const intents = new Set<MemoryIntent>();
  if (TEMPORAL.test(query)) intents.add("temporal");
  if (CAUSAL.test(query)) intents.add("causal");
  if (EPISODIC.test(query)) intents.add("episodic");
  if (CONSTRAINT.test(query)) intents.add("constraint");
  if (MULTIMODAL.test(query)) intents.add("multimodal");
  if (!intents.size) intents.add("factual");
  return [...intents];
}

export function buildRetrievalPlan(query: string): RetrievalPlan {
  const intents = classifyMemoryIntent(query);
  const temporal = intents.includes("temporal");
  const causal = intents.includes("causal");
  const episodic = intents.includes("episodic");
  const constraints = intents.includes("constraint");
  return {
    intents,
    lexicalWeight: 0.35,
    semanticWeight: constraints ? 0.30 : 0.45,
    temporalWeight: temporal ? 0.35 : 0.20,
    graphDepth: causal ? 3 : episodic ? 2 : 1,
    hierarchyLevels: episodic || causal ? [0,1,2] : [1,2],
    requireConstraints: true,
  };
}

function timeMs(value?: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function isValidAt(memory: VersionedMemory, at: Date): boolean {
  if (memory.status === "retracted") return false;
  const t = at.getTime();
  const from = memory.validFrom ? timeMs(memory.validFrom) : Number.NEGATIVE_INFINITY;
  const to = memory.validTo ? timeMs(memory.validTo) : Number.POSITIVE_INFINITY;
  return from <= t && t < to;
}

export function resolveVersionedMemory(items: VersionedMemory[], at = new Date()): VersionedMemory[] {
  const groups = new Map<string, VersionedMemory[]>();
  for (const item of items) {
    if (!isValidAt(item, at)) continue;
    const group = groups.get(item.key) ?? [];
    group.push(item);
    groups.set(item.key, group);
  }

  return [...groups.values()].map(group => group.sort((a,b) => {
    const statusRank = (x: VersionedMemory) => x.status === "active" ? 3 : x.status === "disputed" ? 2 : 1;
    return statusRank(b) - statusRank(a)
      || Number(Boolean(b.explicit)) - Number(Boolean(a.explicit))
      || (b.priority ?? 0) - (a.priority ?? 0)
      || b.confidence - a.confidence
      || timeMs(b.validFrom) - timeMs(a.validFrom)
      || timeMs(b.assertedAt) - timeMs(a.assertedAt);
  })[0]);
}

export function reciprocalRankFusion(rankings: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id,index) => scores.set(id,(scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return scores;
}

export function retrievalBudget(plan: RetrievalPlan): {events:number; claims:number; constraints:number; consolidations:number} {
  const complex = plan.graphDepth > 1 || plan.intents.length > 2;
  return {
    events: complex ? 24 : 12,
    claims: complex ? 16 : 8,
    constraints: 12,
    consolidations: complex ? 8 : 4,
  };
}
