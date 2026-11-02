// 20 independent behavior assertions against the actual TypeScript normalization module.
// Source is compiled in memory; no mock of normalizeAskText is used.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(new URL('../../src/lib/kompasAskText.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const module = { exports: {} }
vm.runInNewContext(compiled, { module, exports: module.exports })
const { normalizeAskText } = module.exports
const cases = [
  [
    "plain question",
    "What is SIEM?",
    "What is SIEM?"
  ],
  [
    "leading spaces",
    "  What is SIEM?",
    "What is SIEM?"
  ],
  [
    "trailing spaces",
    "What is SIEM?  ",
    "What is SIEM?"
  ],
  [
    "repeated spaces",
    "What   is   SIEM?",
    "What is SIEM?"
  ],
  [
    "tab separators",
    "What\tis\tSIEM?",
    "What is SIEM?"
  ],
  [
    "newlines",
    "What\nis\nSIEM?",
    "What is SIEM?"
  ],
  [
    "carriage returns",
    "What\ris\rSIEM?",
    "What is SIEM?"
  ],
  [
    "nonbreaking spaces",
    "What is SIEM?",
    "What is SIEM?"
  ],
  [
    "narrow NBSP",
    "What is SIEM?",
    "What is SIEM?"
  ],
  [
    "ideographic spaces",
    "What　is　SIEM?",
    "What is SIEM?"
  ],
  [
    "zero width space",
    "Wri​te Python",
    "Write Python"
  ],
  [
    "zero width joiner",
    "Wri‍te Python",
    "Write Python"
  ],
  [
    "byte order mark",
    "﻿What is SIEM?",
    "What is SIEM?"
  ],
  [
    "soft hyphen",
    "cy­bersecurity",
    "cybersecurity"
  ],
  [
    "curly apostrophe",
    "What’s IAM?",
    "What's IAM?"
  ],
  [
    "curly double quotes",
    "“SIEM”",
    "\"SIEM\""
  ],
  [
    "line separator",
    "How does RBAC work?",
    "How does RBAC work?"
  ],
  [
    "empty string",
    "",
    ""
  ],
  [
    "null input",
    null,
    ""
  ],
  [
    "numeric input",
    42,
    "42"
  ]
]
for (const [name, input, expected] of cases) {
  test('Kompas transcript normalization: ' + name, () => {
    assert.equal(normalizeAskText(input), expected)
  })
}
