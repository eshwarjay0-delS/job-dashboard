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

// How light a colour looks (0 to 1), how strong it is (0 is grey), and its hue in degrees: OKLCH.
function seen(hex) {
  const [r, g, b] = channels(hex).map(linear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { light: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, strength: Math.hypot(A, B), hue: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 }
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

// ── the night, for eyes (2026-10-08) ─────────────────────────────────────────
// The owner: "I feel like I'm having all this problems when I see the dark mode" (shimmering, zigzag lines, patterns), and
// "see what other people in dark mode had developed and find optimal colors". Eleven widely used dark themes were measured
// (Material, GitHub, GitHub Dimmed, Nord, Tokyo Night, One Dark, VS Code, Discord, Slack, Solarized, Catppuccin): page
// lightness 0.18 to 0.32 with a median of 0.24, body type against the page 4.8 to 16 to 1 with a median of 9.4. Both nights
// this app had before were outside the first and at the very top of the second. These tests keep the night inside.
test('the night page is never near black, and a panel is one small step lighter than the page', () => {
  const page = seen(night['--bg']).light, panel = seen(night['--surface']).light, inset = seen(night['--surface-2']).light
  assert.ok(page >= 0.20 && page <= 0.30, `the page is ${page.toFixed(3)}; the eleven themes are 0.18 to 0.32`)
  assert.ok(panel > page && panel - page <= 0.05, 'a panel is told from the page by a step, not a jump')
  assert.ok(inset > panel && inset - panel <= 0.06)
  for (const gone of [/#060817;\s*\/\* night sky \*\//, /--bg:\s*#121723/]) assert.ok(!gone.test(css), 'neither of the two near-black pages is back')
  assert.ok(!/#121723|#192131|#222c40|#2c3850|#2c3952|#3b4b69|#5f8090|#7396a5|#d98268/i.test(css), 'the night before today is gone')
})

test('night type is a soft silver: bright enough to read, never bright enough to bloom', () => {
  assert.ok(seen(night['--text']).light <= 0.88, 'not near white')
  for (const surface of ['--bg', '--surface']) {
    const got = contrast(night['--text'], night[surface])
    assert.ok(got >= 9 && got <= 11.5, `body type on ${surface} is ${got.toFixed(2)}; the median of the eleven is 9.4 and the two nights before were 16`)
  }
  const quiet = contrast(night['--text-muted'], night['--surface'])
  assert.ok(quiet >= 5.5 && quiet <= 8 && quiet < contrast(night['--text'], night['--surface']) - 2, 'quieter type is visibly quieter')
})

test('nothing large on the night is vivid, and everything is the owner\'s own blue', () => {
  for (const name of ['--bg', '--surface', '--surface-2', '--surface-3', '--border', '--border-strong', '--text', '--text-muted', '--text-soft']) {
    const c = seen(night[name])
    assert.ok(c.strength <= 0.045, `${name} has little colour in it (${c.strength.toFixed(3)})`)
    assert.ok(c.hue >= 235 && c.hue <= 262, `${name} is the blue of the standards (hue ${c.hue.toFixed(0)})`)
  }
  assert.equal(night['--accent-txt'], STANDARDS.moon, 'what is chosen is his moonlight, exactly')
  // Rules are faint: a grid of bright lines on a dark page is its own shimmer.
  assert.ok(contrast(night['--border'], night['--surface']) <= 1.5)
  assert.ok(contrast(night['--border-strong'], night['--surface']) <= 2.2)
})

test('a signal on the night keeps its hue and loses its glare: vivid orange on blue is the pair that seems to vibrate', () => {
  const bonfire = seen(SIGNALS.bonfire), chilli = seen(SIGNALS.chilli)
  const mark = seen(night['--spot']), alert = seen(night['--danger']), rule = seen(night['--danger-border'])
  assert.ok(Math.abs(mark.hue - bonfire.hue) <= 10 && mark.strength <= bonfire.strength * 0.65, 'the mark is bonfire, softened')
  assert.ok(Math.abs(alert.hue - chilli.hue) <= 10 && alert.strength <= chilli.strength * 0.65, 'an alert is chilli, softened')
  assert.ok(Math.abs(rule.hue - chilli.hue) <= 10 && rule.strength <= chilli.strength * 0.7)
  for (const name of ['--spot', '--warning', '--danger', '--success', '--cat-reply', '--cat-int', '--cat-ass']) assert.ok(seen(night[name]).strength <= 0.105, `${name} is not vivid`)
  assert.ok(!Object.values(block('[data-theme="dark"]')).some((v) => /var\(--signal-(bonfire|chilli)\)/.test(v)), 'the full-strength signals are for paper only')
})

test('there is no glow, no gradient and no picture behind the night page', () => {
  assert.equal(night['--page-glow'], 'none')
  assert.ok(!/\.mf-dashboard-shell\s*\{[^}]*background-image/.test(css), 'and the signed-in shell does not put one back')
})

test('the one compromise on the night is known and does not get worse: one accent, under white type and as a link', () => {
  assert.ok(contrast('#ffffff', night['--accent']) >= 4.2, 'white type on the accent')
  assert.ok(contrast(night['--accent'], night['--surface']) >= 3.6, 'a link in the accent on a panel')
  assert.ok(contrast(night['--accent-txt'], night['--accent-soft']) >= 7, 'what is chosen reads easily')
})

test('type clears the floor on every surface it is set on, in both themes', () => {
  for (const [label, theme, floor] of [['paper', paper, 7], ['night', night, 5.5]]) {
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

test('a signal is warm in both themes and readable as type; on paper its rule is the exact colour', () => {
  assert.equal(value(paper, '--spot'), SIGNALS.ember)
  assert.equal(value(paper, '--warning-border'), SIGNALS.bonfire, 'paper: a warning is ruled in bonfire')
  assert.equal(value(paper, '--danger-border'), SIGNALS.chilli, 'paper: an alert is ruled in chilli')
  for (const [label, theme] of [['paper', paper], ['night', night]]) {
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

test('the installed app opens on the night page, not on a grey that is in neither theme', () => {
  const manifest = read('src/app/manifest.ts')
  assert.ok(manifest.includes(`background_color: "${night['--bg']}"`) && manifest.includes(`theme_color: "${night['--bg']}"`))
})

test('the entrance page takes every colour from the theme, so its card is not a white sheet on the night', () => {
  // The owner's screenshot (8 Oct): a white card and white step circles on the night page, with night-coloured fields inside.
  // The page kept six paper colours of its own in a local palette, and a dozen more inline.
  const page = read('src/app/dashboard/setup/page.tsx')
  const palette = page.slice(page.indexOf('const P = {'), page.indexOf('}', page.indexOf('const P = {')))
  assert.ok(!/#[0-9a-f]{3,8}/i.test(palette), 'the page palette holds tokens only')
  for (const name of ['surface', 'text', 'muted', 'hint', 'border', 'bg']) assert.match(palette, new RegExp(name + ': "var\\(--[a-z-]+\\)"'))
  // What is left as a literal: white type on the accent, and the four greys of the Google mark, which is a drawing.
  const literals = new Set(page.match(/#[0-9a-fA-F]{6}\b|#fff\b/g))
  assert.deepEqual([...literals].sort(), ['#7f7c69', '#888471', '#938f7a', '#c6c0b0', '#fff'])
})

test('a production build compiles the stylesheet from the source, never from a restored cache', () => {
  // 8 Oct 2026: the commit that changed the theme went live with its new HTML and the stylesheet of 5 Oct. Vercel had restored
  // .next from the previous deployment and the build "compiled" in 4.5 s. Everything in this file passed while production
  // showed the old colours, so the switch that lets that happen is held here too.
  assert.match(read('next.config.js'), /^\s*turbopackFileSystemCacheForBuild: false,$/m)
})
