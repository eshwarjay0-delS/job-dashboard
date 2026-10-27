// The resume library as a Windows folder window (src/components/FolderBrowser.tsx), rendered for real in a DOM.
// Owner, 20 Oct 2026: "the My files section should be more of how our folders system is designed in windows, the same
// type of navigation. Top level. And folders. The same when selecting the resume in the apply section."
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

// React decides at load time whether it can listen for typing, so the page must exist before it is imported.
const page = new JSDOM('<div id="root"></div>', { url: 'https://mfit.test/dashboard/documents' })
Object.assign(globalThis, { window: page.window, document: page.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
// Other test files run in this process: the page is taken away again when these are done.
test.after(() => { for (const k of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[k]; page.window.close() })

const require = createRequire(import.meta.url)
function component(path, mocks = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  // The browser's own globals the component reaches for, taken from the page being rendered.
  const sandbox = { CSS: { escape: v => String(v).replace(/(["\\])/g, '\\$1') }, get window() { return globalThis.window } }
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', sandbox)(id => id in mocks ? mocks[id] : require(id), module, module.exports)
  return module.exports.default
}
async function domTest(fn) {
  document.body.innerHTML = '<div id="root"></div>'
  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.matchMedia = () => ({ matches: false })
  const root = createRoot(document.getElementById('root'))
  try { await fn(root) } finally { await act(async () => root.unmount()) }
}
const FolderBrowser = component('../../src/components/FolderBrowser.tsx', { './folder-browser.css': {} })

const mk = (email, folder, name, o = {}) => ({ id: `f_${name}`, filename: name, filepath: `/u/${email}/${folder}/${name}.docx`, category: `${email} / ${folder}`, size: '24.0 KB', uploadedAt: '2026-10-18T15:00:00Z', kind: 'docx', ...o })
const FILES = [
  mk('a@x.com', 'Identity and Access Management', 'Cyber Security Analyst'),
  mk('a@x.com', 'AI Security and Governance', 'AI plus AppSec', { size: '31.9 KB', uploadedAt: '2026-10-15T15:00:00Z' }),
  mk('a@x.com', 'General Security', 'Security Analyst - InfoPeople (tailored)__fedcba9876543210', { uploadedAt: '2026-10-19T15:00:00Z' }),
  mk('b@y.com', 'AppSec Engineer', 'AppSec Engineer'),
  mk('b@y.com', 'AWS Security', 'Cloud Security Engineer', { kind: 'pdf', size: '88.0 KB' }),
]
const names = () => [...document.querySelectorAll('.mf-fx-table tbody .mf-fx-label')].map(n => n.textContent)
const crumbs = () => [...document.querySelectorAll('.mf-fx-address .mf-fx-crumb')].map(n => n.textContent)
// In the full suite another test (apply-search-race) loads React before any page exists; React then watches typing
// through focus and key events instead of "input" (it decides once, at load), so the box is focused, typed into and a
// key is let go. React reports one change either way.
const typeInto = (el, text) => act(async () => {
  el.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }))
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, text)
  el.dispatchEvent(new window.InputEvent('input', { bubbles: true, data: text }))
  el.dispatchEvent(new window.KeyboardEvent('keyup', { bubbles: true, key: text.slice(-1) || 'Backspace' }))
})
const click = (el) => act(async () => el.click())
const dbl = (el) => act(async () => el.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true })))
const row = (label) => [...document.querySelectorAll('.mf-fx-table tbody tr')].find(r => r.querySelector('.mf-fx-label')?.textContent === label)
const btn = (label) => document.querySelector(`button[aria-label="${label}"]`)

test('the top level is each email; a double click opens a folder; the address bar, Up, Back and Forward follow', () => domTest(async (root) => {
  await act(async () => root.render(React.createElement(FolderBrowser, { files: FILES, mode: 'browse' })))
  assert.deepEqual(names(), ['a@x.com', 'b@y.com'])
  assert.deepEqual(crumbs(), ['My files'])
  await dbl(row('a@x.com'))
  assert.deepEqual(crumbs(), ['My files', 'a@x.com'])
  assert.deepEqual(names(), ['AI Security and Governance', 'General Security', 'Identity and Access Management'])
  await dbl(row('General Security'))
  assert.deepEqual(crumbs(), ['My files', 'a@x.com', 'General Security'])
  assert.deepEqual(names(), ['Security Analyst - InfoPeople'], 'a resume made for a job is shown without its hash and "(tailored)"')
  assert.ok(row('Security Analyst - InfoPeople').textContent.includes('Made for a job'))
  assert.equal(document.querySelector('.mf-fx-status').textContent.startsWith('1 item'), true)
  await click(btn('Up one folder')); assert.deepEqual(crumbs(), ['My files', 'a@x.com'])
  await click(btn('Back')); assert.deepEqual(crumbs(), ['My files', 'a@x.com', 'General Security'])
  await click(btn('Forward')); assert.deepEqual(crumbs(), ['My files', 'a@x.com'])
  await click(document.querySelectorAll('.mf-fx-address .mf-fx-crumb')[0]); assert.deepEqual(crumbs(), ['My files'])
  assert.equal(btn('Up one folder').disabled, true); assert.equal(btn('Forward').disabled, true)
}))

test('Enter opens, Backspace goes up, the arrows move; a phone taps once to open', () => domTest(async (root) => {
  await act(async () => root.render(React.createElement(FolderBrowser, { files: FILES, mode: 'browse' })))
  const list = document.querySelector('.mf-fx-list')
  const key = (k, o = {}) => act(async () => list.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...o })))
  await key('ArrowDown'); await key('ArrowDown')
  assert.ok(row('b@y.com').className.includes('is-active'))
  await key('Enter'); assert.deepEqual(crumbs(), ['My files', 'b@y.com'])
  await key('Backspace'); assert.deepEqual(crumbs(), ['My files'])
  await key('ArrowDown'); await key('Enter'); await key('ArrowLeft', { altKey: true }); assert.deepEqual(crumbs(), ['My files'])
}))

test('the list can be sorted, and a search looks through every folder under where you are, naming where each one is', () => domTest(async (root) => {
  await act(async () => root.render(React.createElement(FolderBrowser, { files: FILES, mode: 'browse' })))
  await dbl(row('a@x.com'))
  await dbl(row('Identity and Access Management'))
  await click(document.querySelectorAll('.mf-fx-address .mf-fx-crumb')[1])
  const search = document.querySelector('.mf-fx-search')
  await typeInto(search, 'analyst')
  assert.deepEqual(names(), ['Cyber Security Analyst', 'Security Analyst - InfoPeople'])
  assert.ok(document.querySelector('.mf-fx-where').textContent.includes('a@x.com'))
  await typeInto(search, 'zzz')
  assert.ok(document.querySelector('.mf-fx-empty').textContent.includes('Nothing here matches'))
  await typeInto(search, '')
  // Sorted by date modified, newest last then first; folders stay on top.
  await dbl(row('General Security')); await click(btn('Up one folder'))
  const header = [...document.querySelectorAll('.mf-fx-table th button')].find(b => b.textContent.startsWith('Date modified'))
  await click(header); const up = names()
  await click(header); const down = names()
  assert.deepEqual(up.slice().reverse(), down)
}))

test('browse mode: a checkbox on every row for Move and Delete, and View and Download beside each resume', () => domTest(async (root) => {
  const checked = new Set(), toggled = []
  await act(async () => root.render(React.createElement(FolderBrowser, { files: FILES, mode: 'browse', checked, onToggle: k => toggled.push(k) })))
  await dbl(row('b@y.com')); await dbl(row('AWS Security'))
  const r = row('Cloud Security Engineer')
  assert.ok(r.querySelector('a[title="Look at this resume"]').href.includes('/api/resumes/download?') && r.querySelector('a[title="Look at this resume"]').href.includes('inline=1'), 'a PDF opens as itself')
  assert.ok(r.querySelector('a[aria-label^="Download"]').href.includes('/api/resumes/download?filepath='))
  await click(r.querySelector('input[type=checkbox]'))
  assert.deepEqual(toggled, ['f:/u/b@y.com/AWS Security/Cloud Security Engineer.docx'])
}))

test('pick mode: a click chooses a resume, the window opens at the one chosen and follows when Apply chooses another, and a narrow window drops the folder pane', () => domTest(async (root) => {
  const picked = []
  const props = { files: FILES, mode: 'pick', compact: true, onPick: f => picked.push(f.filename) }
  await act(async () => root.render(React.createElement(FolderBrowser, { ...props, selectedPath: '/u/a@x.com/Identity and Access Management/Cyber Security Analyst.docx' })))
  assert.deepEqual(crumbs(), ['My files', 'a@x.com', 'Identity and Access Management'])
  assert.ok(row('Cyber Security Analyst').textContent.includes('Selected'))
  assert.equal(document.querySelector('.mf-fx-tree'), null, 'compact: no folder pane')
  assert.equal(document.querySelector('.mf-fx-table input[type=checkbox]'), null, 'no checkboxes when choosing')
  await act(async () => root.render(React.createElement(FolderBrowser, { ...props, selectedPath: '/u/a@x.com/General Security/Security Analyst - InfoPeople (tailored)__fedcba9876543210.docx' })))
  assert.deepEqual(crumbs(), ['My files', 'a@x.com', 'General Security'])
  await click(row('Security Analyst - InfoPeople'))
  assert.deepEqual(picked, ['Security Analyst - InfoPeople (tailored)__fedcba9876543210'])
  // A resume that is not listed yet (just made) is followed once it is.
  const later = '/u/b@y.com/AppSec Engineer/New one.docx'
  await act(async () => root.render(React.createElement(FolderBrowser, { ...props, selectedPath: later })))
  assert.deepEqual(crumbs(), ['My files', 'a@x.com', 'General Security'])
  await act(async () => root.render(React.createElement(FolderBrowser, { ...props, files: [...FILES, mk('b@y.com', 'AppSec Engineer', 'New one')], selectedPath: later })))
  assert.deepEqual(crumbs(), ['My files', 'b@y.com', 'AppSec Engineer'])
}))

test('the window shows the folder pane (with counts) when it is not compact, and the Files page is made of it', () => domTest(async (root) => {
  await act(async () => root.render(React.createElement(FolderBrowser, { files: FILES, mode: 'browse' })))
  const tree = [...document.querySelectorAll('.mf-fx-tree [role=treeitem]')].map(n => n.textContent)
  assert.ok(tree[0].startsWith('My files') && tree[0].endsWith('5'))
  assert.ok(tree.some(t => t.startsWith('a@x.com') && t.endsWith('3')))
  assert.ok(tree.some(t => t.startsWith('General Security')))
  await click([...document.querySelectorAll('.mf-fx-tree [role=treeitem]')].find(n => n.textContent.startsWith('b@y.com')))
  assert.deepEqual(crumbs(), ['My files', 'b@y.com'])
  const files = readFileSync(new URL('../../src/app/dashboard/documents/DocumentsClient.tsx', import.meta.url), 'utf8')
  assert.ok(files.includes('<FolderBrowser') && files.includes('mode="browse"') && files.includes('onDropFiles={handleFiles}'))
}))
