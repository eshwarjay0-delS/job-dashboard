export function fixtureName(value = 'interview-50') {
 if (!['interview-50', 'intent-acceptance-v1', 'crossdomain-50'].includes(value)) throw Error('Unknown evaluation fixture')
 return value
}
export function caseInput(c, sources, fixture) {
 const key = fixture === 'interview-50' ? c.chain : c.id
 const source = sources[key]
 if (!['resume','jd'].every(k => typeof source?.[k] === 'string' && source[k].trim())) throw Error(`Missing approved resume/JD bundle for ${key}; zero model calls made.`)
 const dependent = fixture !== 'interview-50' && ['intro-repeat','drilldown','follow-up'].includes(c.category)
 const history = source.history
 if (dependent && (!Array.isArray(history) || !history.length || !history.every(t => typeof t?.q === 'string' && t.q.trim() && typeof t?.a === 'string' && t.a.trim()))) throw Error(`Missing explicit reviewed history for ${key}; zero model calls made.`)
 if (fixture !== 'interview-50' && !dependent && (history !== undefined || source.ledger !== undefined)) throw Error(`Isolated case ${key} must not include prior history or ledger; zero model calls made.`)
 return { historyMode: fixture === 'interview-50' ? 'chain' : dependent ? 'reviewed' : 'isolated', ledger: dependent ? source.ledger : undefined, key, config: { resume: source.resume, jd: source.jd }, history: dependent ? history : [] }
}
