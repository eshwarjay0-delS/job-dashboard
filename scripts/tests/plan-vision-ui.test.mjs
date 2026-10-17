import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PRODUCT_PLANS, PLAN_REVISION } from '../../src/lib/plan-vision.ts'
const require = createRequire(import.meta.url)
test('developers can switch every area and presentation and keep shareable URLs', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://mfit.test/dashboard/admin/plan-vision' })
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let params = new URLSearchParams(), area = "gmail", root, Component
  const render = () => root.render(React.createElement(Component, { plans: PRODUCT_PLANS, revision: PLAN_REVISION, initialArea: area }))
  const code = ts.transpileModule(readFileSync(new URL('../../src/app/dashboard/admin/plan-vision/plan-vision.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  const scopedRequire = id => {
    if (id.includes('/vision/_components/md')) return { __esModule: true, default: () => null }
    if (id === 'next/navigation') return { useSearchParams: () => params, useRouter: () => ({ replace: url => { const parsed = new URL(url, 'https://mfit.test'); params = parsed.searchParams; const slug = parsed.pathname.split('/').pop(); area = slug === 'apply' ? 'applications' : slug; render() } }) }
    if (id === 'next/link') return { __esModule: true, default: ({children,...props}) => React.createElement('a',props,children) }
    if (id.endsWith('.css')) return { __esModule:true, default: new Proxy({}, {get:(_,key)=>String(key)}) }
    return require(id)
  }
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})')(scopedRequire,module,module.exports)
  Component = module.exports.default; root = createRoot(document.getElementById('root'))
  try {
    await act(async () => render())
    const click = async text => { const button = [...document.querySelectorAll('button')].find(b=>b.textContent===text); assert.ok(button,text); await act(async()=>button.click()) }
    for (const plan of PRODUCT_PLANS) {
      await click(plan.title); assert.equal(area,plan.id)
      await click('Mind map'); assert.equal(params.get('view'),'mind-map'); assert.equal(document.querySelectorAll('.branches details').length,4)
      await click('Image overview'); assert.equal(params.get('view'),'image'); assert.ok(document.querySelector('figure img').getAttribute('src').includes('area='+plan.id))
      await click('Developer notes'); assert.equal(document.querySelectorAll('.notes section').length,4)
      const downloads=[...document.querySelectorAll('.downloads a')]; assert.equal(downloads.length,2); for(const a of downloads)assert.ok(a.href.includes('area='+plan.id))
    }
    area='unknown'; params=new URLSearchParams('view=unknown'); await act(async()=>render()); assert.equal(document.querySelector('#plan-title').textContent,'Gmail')
  } finally { await act(async()=>root.unmount()); Object.assign(globalThis,previous); dom.window.close() }
})
