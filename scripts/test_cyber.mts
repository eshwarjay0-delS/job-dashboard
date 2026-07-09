// Validate auto-select + tailoring for the (intentional) 15-resume Cyber Marketing
// library: one realistic cyber JD per identity → auto-select must pick the matching
// resume and tailor it into the 90s. Writes a sensible Tailored_Resumes.zip.
// Run:  npx tsx scripts/test_cyber.mts   (server running with the key)
import { readFile, writeFile, mkdir, readdir, rm } from "fs/promises"
import path from "path"
import JSZip from "jszip"

const SERVER = process.env.SERVER || "http://localhost:3000"
const OUT = path.join(process.cwd(), "data", "cyber_out")
const ZIP_PATH = path.join(process.cwd(), "data", "Tailored_Resumes.zip")

// { title, expect (substring the picked category leaf should contain), jd }
const CASES: { title: string; expect: string; jd: string }[] = [
  { title: "Penetration Tester", expect: "penetration", jd: "Penetration Tester. Conduct network and web application penetration testing with Kali Linux, Metasploit, Burp Suite, and Nmap. Exploit vulnerabilities, run OSCP-style assessments, and write remediation reports. Requirements: OSCP, exploit development, vulnerability assessment." },
  { title: "Red Team Operator", expect: "red team", jd: "Red Team Operator. Adversary simulation and command-and-control with Cobalt Strike, lateral movement, privilege escalation, and post-exploitation mapped to MITRE ATT&CK. Requirements: red team operations, evasion, social engineering." },
  { title: "SOC Analyst", expect: "soc", jd: "SOC Analyst. Security operations center monitoring with Splunk SIEM, threat detection, incident response, log analysis, and alert triage. Requirements: SOC, EDR, threat intelligence, SIEM." },
  { title: "IAM Engineer", expect: "iam", jd: "IAM Engineer. Identity and access management with SailPoint and Saviynt, Okta SSO, SAML, RBAC, and privileged access management with CyberArk across Active Directory. Requirements: IAM, PAM, identity lifecycle." },
  { title: "Cloud Security Engineer", expect: "cloud", jd: "Cloud Security Engineer. Secure AWS and Azure with IAM policies, CSPM, Terraform, and Kubernetes security; harden S3 and workloads. Requirements: cloud security, container security, infrastructure as code." },
  { title: "Application Security Engineer", expect: "appsec", jd: "Application Security Engineer. SAST and DAST, secure code review, OWASP Top 10, SonarQube, Fortify, Snyk, and CI/CD security with threat modeling. Requirements: application security, secure SDLC." },
  { title: "DevSecOps Engineer", expect: "devsecops", jd: "DevSecOps Engineer. Shift-left security in CI/CD pipelines (Jenkins, GitLab), container and image scanning, IaC security, secrets management, Docker and Kubernetes. Requirements: DevSecOps, automation, pipeline security." },
  { title: "Network Security Engineer", expect: "network", jd: "Network Security Engineer. Firewalls, IDS/IPS, VPN, routing and switching, Wireshark packet analysis, network segmentation, and Zero Trust. Requirements: network security, Cisco." },
  { title: "Security Architect", expect: "architect", jd: "Security Architect. Enterprise security architecture and GRC aligned to NIST, ISO 27001, and SOC 2; risk assessment, governance, compliance, and security design reviews. Requirements: security architecture, risk management." },
  { title: "Security Engineer", expect: "security engineer", jd: "Security Engineer. Endpoint security with EDR/XDR, vulnerability management, system hardening, PKI and cryptography, and SIEM integration. Requirements: security engineering, hardening." },
  { title: "Security Analyst", expect: "security analyst", jd: "Security Analyst. Threat intelligence, vulnerability management with Nessus, risk assessment, compliance, and security monitoring. Requirements: security analysis, reporting." },
  { title: "OT Security Engineer", expect: "ot", jd: "OT Security Engineer. Operational technology security for ICS and SCADA, PLC and industrial control systems, and critical infrastructure protection aligned to IEC 62443. Requirements: OT security." },
  { title: "Database Administrator", expect: "database", jd: "Database Administrator. Administer SQL Server, Oracle, MySQL, and PostgreSQL; backups, performance tuning, data security, and high availability. Requirements: DBA, database security." },
  { title: "System Administrator", expect: "admin", jd: "System Administrator. Windows and Linux administration, Active Directory and Group Policy, patching, virtualization with VMware, and endpoint management. Requirements: system administration." },
  { title: "Business Systems Analyst", expect: "business analyst", jd: "Business Systems Analyst. Requirements gathering, stakeholder management, process improvement, BPMN, and system design with clear documentation. Requirements: business analysis, systems engineering." },
]

const leaf = (cat: string) => (cat.split("/").pop() || cat).trim().toLowerCase()
const sanitize = (s: string) => s.replace(/[^A-Za-z0-9 +&-]/g, "_").replace(/\s+/g, " ").trim().slice(0, 40)

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const manifest: string[] = ["# Cyber library — JD → auto-selected resume → match (before→after)", ""]
  let ok = 0, correct = 0
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i]
    try {
      const res = await fetch(`${SERVER}/api/tailor`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jd: `${c.title}\n\n${c.jd}`, filepath: "" }), // real title line + auto-select
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { console.log(`  [skip] ${c.title} -> ${d.error || res.status}`); continue }
      const cat = d.matched?.category || "?"
      const hit = leaf(cat).includes(c.expect)
      if (hit) correct++
      ok++
      const f = await fetch(`${SERVER}/api/tailor/file?token=${d.token}&fmt=docx&name=${encodeURIComponent(d.matched?.filename || "Resume")}`)
      const file = `${String(ok).padStart(2, "0")}_${sanitize(c.title)}.docx`
      if (f.ok) await writeFile(path.join(OUT, file), Buffer.from(await f.arrayBuffer()))
      manifest.push(`${hit ? "OK " : "XX "} ${c.title}  ->  ${cat}  |  ${d.score_before}%→${d.score}%`)
      console.log(`  [${hit ? "correct" : "WRONG  "}] ${c.title.padEnd(30)} -> ${cat}  (${d.score_before}%→${d.score}%)`)
    } catch (e) { console.log(`  [err] ${c.title} -> ${String(e).slice(0, 80)}`) }
  }
  manifest.unshift(`Selection correct: ${correct}/${CASES.length}    Tailored: ${ok}/${CASES.length}`, "")
  await writeFile(path.join(OUT, "INDEX.txt"), manifest.join("\n"))
  const zip = new JSZip()
  for (const f of await readdir(OUT)) zip.file(f, await readFile(path.join(OUT, f)))
  await writeFile(ZIP_PATH, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))
  console.log(`\n==== selection ${correct}/${CASES.length} correct | ${ok} tailored ====\nZip: ${ZIP_PATH}`)
}
main()
