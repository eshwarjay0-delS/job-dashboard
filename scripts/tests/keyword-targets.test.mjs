// What a tailored resume must contain (src/lib/keyword-targets.ts), checked on the real keywords of the owner's
// micro-segmentation job of 19 Oct 2026: the job post's literal extraction and Gemini's two passes, as measured.
import test from 'node:test'
import assert from 'node:assert/strict'
import { targetKeywords, skillLike, placeInSkills, isCertification, jdSpelling } from '../../src/lib/keyword-targets.ts'

const literal = ['siem', 'splunk', 'ansible', 'aws', 'azure', 'zero trust', 'firewall', 'vpn', 'tcp/ip', 'dns', 'routing', 'network security',
  'compliance', 'nist', 'pci', 'python', 'policy', 'palo alto', 'ipsec', 'micro-segmentation', 'vpc', 'vnet', 'tcp', 'ip', 'globalprotect',
  'pcnse', 'dss', 'micro-segmentation security', 'firewall policies', 'vnet segmentation', 'automate policy', 'network protocols',
  'siem integration', 'micro', 'palo', 'alto', 'panorama', 'illumio', 'guardicore', 'zero', 'trust', 'technology', 'protocols']
const gemini = ['palo alto firewalls', 'panorama', 'illumio', 'guardicore', 'cloud teams', 'infrastructure teams', 'firewall policies',
  'map application dependencies', 'security enforcement', 'enterprise environments', 'device groups', 'data centers', 'enforcement boundaries',
  'clean up firewall rule bases', 'remove shadowed and overly permissive rules', 'aws and azure network security groups', 'vpc/vnet segmentation',
  'troubleshoot tcp/ip', 'load balancer', 'automate policy changes', 'document standards', 'change records', '7+ years',
  'network security engineering', 'pcnse', 'pci dss']

test('the target is the job post\'s terms and Gemini\'s skill-like ones together, without generic words or fragments', () => {
  const t = targetKeywords(literal, gemini)
  for (const k of ['palo alto', 'micro-segmentation', 'illumio', 'guardicore', 'panorama', 'network protocols', 'zero trust', 'splunk',
    'palo alto firewalls', 'security enforcement', 'device groups', 'load balancer', 'pci dss', 'network security engineering'])
    assert.ok(t.includes(k), 'kept: ' + k)
  for (const k of ['technology', 'protocols', 'policy', 'micro', 'palo', 'alto', 'zero', 'trust', 'tcp', 'ip', 'dss', '7+ years',
    'cloud teams', 'enterprise environments', 'map application dependencies', 'clean up firewall rule bases',
    'remove shadowed and overly permissive rules', 'aws and azure network security groups', 'troubleshoot tcp/ip', 'document standards'])
    assert.ok(!t.includes(k), 'dropped: ' + k)
  assert.equal(new Set(t).size, t.length, 'no duplicates')
})

test('Gemini suggestions are kept only when they read as a skill', () => {
  assert.ok(skillLike('illumio') && skillLike('security enforcement') && skillLike('pci dss'))
  assert.ok(!skillLike('7+ years') && !skillLike('deploy and operate') && !skillLike('cloud teams') && !skillLike('technology'))
})

test('a certification is never written in: listing it claims to hold it', () => {
  assert.ok(isCertification('pcnse') && isCertification('CISSP') && isCertification('AWS Certified Security') && isCertification('az-500'))
  assert.ok(!isCertification('palo alto') && !isCertification('illumio') && !isCertification('zero trust'))
})

test('each missing term goes onto the skills line it fits, in the job post\'s spelling, keeping the line\'s heading and separator', () => {
  const jd = 'Hands-on experience with Palo Alto firewalls, Panorama, and micro-segmentation platforms such as Illumio or Guardicore. Knowledge of network protocols.'
  const lines = [
    { idx: 10, text: 'Network Security: Palo Alto, Fortinet, Cisco ASA, Firewall Rules' },
    { idx: 11, text: 'Cloud Platforms: AWS, Azure, GCP' },
    { idx: 12, text: 'SIEM | Splunk | Sentinel.' },
  ]
  const out = placeInSkills(lines, ['illumio', 'network protocols', 'guardicore', 'micro-segmentation', 'aws'], jd)
  const net = out.find(l => l.idx === 10)?.text || ''
  assert.ok(net.startsWith('Network Security: Palo Alto, Fortinet'), net)
  assert.ok(net.includes('network protocols'), net)
  // Each term lands once, in the JD's spelling, somewhere on the skills lines.
  const all = [...lines.filter(l => !out.some(o => o.idx === l.idx)), ...out].map(l => l.text).join('\n')
  for (const k of ['Illumio', 'Guardicore', 'micro-segmentation']) assert.equal(all.split(k).length - 1, 1, k + ' once in: ' + all)
  assert.ok(!out.some(l => l.idx === 11), 'AWS was already on the cloud line, so that line is untouched')
  const piped = placeInSkills([{ idx: 12, text: 'SIEM | Splunk | Sentinel.' }], ['qradar'], 'QRadar')
  assert.equal(piped[0].text, 'SIEM | Splunk | Sentinel | QRadar.')
  const bare = placeInSkills([{ idx: 1, text: 'Tools:' }], ['illumio'], jd)
  assert.equal(bare[0].text, 'Tools: Illumio')
  assert.equal(jdSpelling('palo alto', jd), 'Palo Alto')
})
