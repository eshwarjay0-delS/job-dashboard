// The two themes (2026-10-08). The owner gave the colours himself, in three lots: nine standards for the night and the ink,
// and five warm signals for "wherever we need show distinguishes and push alerts even on the paper mode". A palette drifts one
// "close enough" at a time, and a colour that is on the list can still be unreadable where it is put, so both are held here:
// the exact colours, and that every piece of type clears a contrast floor on the surface it is actually drawn on.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const css = read('src/app/globals.css')

// The declarations of one rule, by its exact opening line.
function block(opening) {
  const start = css.indexOf('\n' + opening + ' {\n')
  assert.notEqual(start, -1, `globals.css has a rule opening "${opening} {"`)
  const body = css.slice(start, css.indexOf('\n}\n', start)).replace(/\/\*[\s\S]*?\*\//g, '')
  const out = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().toLowerCase()
  return out
}
const paper = block(':root')
const night = { ...paper, ...block('[data-theme="dark"]') }
// A token's colour in a theme, following var() to the end.
const value = (theme, name) => {
  let v = theme[name]
  for (let i = 0; i < 8 && v && v.startsWith('var('); i++) v = theme[v.slice(4, -1).trim()]
  return v
}

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const linear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const light = (rgb) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
// A colour as it lands on a surface: an rgba() tint is laid over the surface first.
function over(colour, surface) {
  if (colour.startsWith('#')) return channels(colour)
  const [r, g, b, a] = colour.slice(colour.indexOf('(') + 1, -1).split(',').map(Number)
  const under = channels(surface)
  return [r, g, b].map((c, i) => c * a + under[i] * (1 - a))
}
function contrast(type, surface, under) {
  const a = light(over(type, under ?? surface)), b = light(over(surface, under ?? surface))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const STANDARDS = { sky: '#060817', navy: '#16254f', deep: '#1b3a57', slate: '#2c3e50', steel: '#4a6e8d', haze: '#667d9d', mist: '#acbbc6', moon: '#a4c8e1', silver: '#ececec' }
const SIGNALS = { bonfire: '#f47c54', chilli: '#cb4e42', ember: '#ad564b', graphite: '#5c646c', dusk: '#414150' }

test('the nine standards and the five signals are named once, with exactly the colours the owner gave', () => {
  for (const [name, hex] of Object.entries(STANDARDS)) assert.equal(paper[`--night-${name}`], hex, `--night-${name}`)
  for (const [name, hex] of Object.entries(SIGNALS)) assert.equal(paper[`--signal-${name}`], hex, `--signal-${name}`)
})

test('paper keeps its paper and takes the standard inks: only the type changed', () => {
  const sheet = { '--bg': '#f8f6f1', '--surface': '#fdfcf9', '--surface-2': '#efece5', '--surface-3': '#e6e2d8', '--border': '#e2ded4', '--border-strong': '#d3cec1' }
  for (const [name, hex] of Object.entries(sheet)) assert.equal(paper[name], hex, `${name} is the paper it was`)
  assert.equal(paper['--text'], STANDARDS.sky)
  assert.equal(paper['--text-muted'], STANDARDS.navy)
  assert.equal(paper['--text-soft'], STANDARDS.haze)
  assert.equal(paper['--accent-txt'], STANDARDS.sky)
  assert.ok(!/#15140f|#55534a|#86826f/i.test(css), 'none of the old brown inks is left anywhere in the stylesheet')
})

test('the night is built from the standards, and none of the colours it replaced is left', () => {
  const made = { '--bg': 'sky', '--surface-2': 'navy', '--surface-3': 'deep', '--border': 'slate', '--border-strong': 'steel', '--text': 'silver', '--text-muted': 'mist', '--accent-txt': 'moon', '--accent-soft': 'navy', '--accent-border': 'steel' }
  for (const [name, standard] of Object.entries(made)) assert.equal(value(night, name), STANDARDS[standard], `${name} is ${standard}`)
  assert.ok(!/#121723|#192131|#222c40|#2c3850|#2c3952|#3b4b69|#5f8090|#7396a5|#d98268/i.test(css), 'the old night is gone')
})

test('the three night values that are a step off a standard each read better than the standard they left', () => {
  // A hint in haze is 3.5 to 1 on a navy panel; the step taken has to clear the floor there.
  assert.ok(contrast(STANDARDS.haze, night['--surface-2']) < 4.5)
  assert.ok(contrast(night['--text-soft'], night['--surface-2']) >= 4.5)
  // The accent is both the fill under white type and the colour of small links. Steel fails as a link; the step taken
  // carries white type and reads as a link better than steel does.
  assert.ok(contrast('#ffffff', night['--accent']) >= 4.5, 'white type on the accent')
  assert.ok(contrast(night['--accent'], night['--surface']) > contrast(STANDARDS.steel, night['--surface']) + 0.4, 'a link in the accent')
  assert.ok(contrast(night['--accent'], night['--surface']) >= 3.6)
  // A panel is distinguishable from the sky and from the inset inside it.
  assert.ok(light(channels(night['--bg'])) < light(channels(night['--surface'])))
  assert.ok(light(channels(night['--surface'])) < light(channels(night['--surface-2'])))
})

test('type clears the floor on every surface it is set on, in both themes', () => {
  for (const [label, theme, floor] of [['paper', paper, 7], ['night', night, 4.5]]) {
    for (const surface of ['--bg', '--surface', '--surface-2']) {
      for (const type of ['--text', '--text-muted']) {
        const got = contrast(value(theme, type), value(theme, surface))
        assert.ok(got >= floor, `${label}: ${type} on ${surface} is ${got.toFixed(2)}`)
      }
    }
  }
  for (const surface of ['--bg', '--surface', '--surface-2']) {
    assert.ok(contrast(value(night, '--text-soft'), value(night, surface)) >= 4.5, `night: a hint on ${surface}`)
  }
  // A hint on paper is deliberately light, and was 3.58 before; the standard ink must not be fainter than what it replaced.
  assert.ok(contrast(value(paper, '--text-soft'), paper['--bg']) >= 3.58)
})

test('a signal is warm in both themes, readable as type, and its rule is the exact colour', () => {
  assert.equal(value(paper, '--spot'), SIGNALS.ember)
  assert.equal(value(night, '--spot'), SIGNALS.bonfire)
  for (const [label, theme] of [['paper', paper], ['night', night]]) {
    assert.equal(value(theme, '--warning-border'), SIGNALS.bonfire, `${label}: a warning is ruled in bonfire`)
    assert.equal(value(theme, '--danger-border'), SIGNALS.chilli, `${label}: an alert is ruled in chilli`)
    for (const surface of ['--bg', '--surface']) {
      const got = contrast(value(theme, '--spot'), value(theme, surface))
      assert.ok(got >= 4.5, `${label}: the mark on ${surface} is ${got.toFixed(2)}`)
    }
    assert.ok(contrast(value(theme, '--spot-ink'), value(theme, '--spot')) >= 4.5, `${label}: type on a filled mark`)
    for (const kind of ['--warning', '--danger']) {
      const got = contrast(value(theme, kind), value(theme, `${kind}-soft`), value(theme, '--surface'))
      assert.ok(got >= 4.5, `${label}: ${kind} on its own tint is ${got.toFixed(2)}`)
    }
  }
})

test('every stage can be read on its own chip in both themes, and the three that need the person are the warm ones', () => {
  const stages = ['out', 'reply', 'int', 'ass', 'fol', 'rtr', 'saved']
  const warm = (hex) => { const [r, , b] = channels(hex); return r > b + 40 }
  for (const [label, theme] of [['paper', paper], ['night', night]]) {
    for (const stage of stages) {
      const got = contrast(theme[`--cat-${stage}`], theme[`--cat-${stage}-bg`], value(theme, '--surface'))
      assert.ok(got >= 4.5, `${label}: ${stage} on its chip is ${got.toFixed(2)}`)
      assert.ok(contrast(theme[`--cat-${stage}`], value(theme, '--surface')) >= 4.5, `${label}: ${stage} drawn straight on a panel`)
      assert.equal(warm(theme[`--cat-${stage}`]), ['reply', 'int', 'ass'].includes(stage), `${label}: ${stage}`)
    }
    assert.equal(new Set(stages.map((s) => theme[`--cat-${s}`])).size, stages.length, `${label}: no two stages share a colour`)
  }
})

test('nothing warm lights the night sky, so a signal is the only warm thing on the page', () => {
  const glow = [...night['--page-glow'].matchAll(/rgba\((\d+),(\d+),(\d+),/g)].map((m) => m.slice(1, 4).map(Number))
  assert.ok(glow.length >= 2)
  for (const [r, , b] of glow) assert.ok(b > r, `rgba(${r}, …, ${b}) is cool`)
})

test('the signed-in pages show the same sky: the shell that covers the body carries its light on the night only', () => {
  assert.match(read('src/app/dashboard/layout.tsx'), /className="mf-dashboard-shell"/)
  assert.match(css, /\[data-theme="dark"\] \.mf-dashboard-shell \{ background-image:var\(--page-glow\)/)
  assert.ok(!/^\.mf-dashboard-shell/m.test(css), 'paper is not given a glow it did not have')
})

test('a warm stage colour is not borrowed for something that is not a stage, where it would read as an alert', () => {
  // Three places used --cat-int and --cat-reply as a general tint while they were grey: a note in Settings, a key chip, and the
  // before and after lines of a resume change. Made warm, they turned a plain note into what looked like an error.
  const borrowed = []
  const walk = (dir) => {
    for (const entry of readdirSync(new URL('../../' + dir + '/', import.meta.url), { withFileTypes: true })) {
      const path = dir + '/' + entry.name
      if (entry.isDirectory()) walk(path)
      else if (path.endsWith('.tsx') && /var\(--cat-(reply|int|ass)/.test(read(path))) borrowed.push(path)
    }
  }
  walk('src')
  assert.deepEqual(borrowed, ['src/app/dashboard/resume/LibraryTree.tsx'], 'only the resume folders, which are told apart by colour on purpose')
})

test('the installed app opens on the night sky, not on a grey that is in neither theme', () => {
  const manifest = read('src/app/manifest.ts')
  assert.match(manifest, /background_color: "#060817"/)
  assert.match(manifest, /theme_color: "#060817"/)
})
