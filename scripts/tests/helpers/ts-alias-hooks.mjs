// Lets plain Node run the project's TypeScript as the app does: "@/x" is src/x, and an import with no ending is a .ts
// (or .tsx, or a folder's index.ts) file. Use with --experimental-transform-types:
//   PROJECT_DIR=<repo> node --experimental-transform-types --import <this file's URL> script.mjs
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const SRC = path.join(process.env.PROJECT_DIR || process.cwd(), 'src')
const isFile = (p) => existsSync(p) && statSync(p).isFile()
const pick = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(isFile)

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const found = pick(path.join(SRC, specifier.slice(2)))
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
      const found = pick(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier))
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true }
    }
    return next(specifier, context)
  },
})
