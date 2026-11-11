import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const start = app.indexOf('function dictateStep(')
const end = app.indexOf('// Audio-silence watchdog hooks', start)
if (start < 0 || end <= start) throw new Error('dictateStep slice missing')
const THEM = app.includes('const THEM_SILENCE_MS = 1400') ? 'const THEM_SILENCE_MS = 1400;\n' : ''
const ctx = createContext({})
runInContext(THEM + app.slice(start, end) + '\nthis.dictateStep = dictateStep;', ctx)
export const dictateStep = ctx.dictateStep
