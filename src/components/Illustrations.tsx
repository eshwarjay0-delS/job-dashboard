"use client"
// ─────────────────────────────────────────────────────────────────────────────
// CareerKit — 10 flat art-style SVG illustrations
// Style: modern flat illustration, diverse characters, consistent proportions
// Each component accepts className and style props for sizing
// ─────────────────────────────────────────────────────────────────────────────

interface IllustProps {
  className?: string
  style?: React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TAILOR — Person at laptop watching resume get keyword-matched in 12s
// Placement: Features carousel slide 1
// ─────────────────────────────────────────────────────────────────────────────
export function IllustTailor({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#f2f0ea"/>
      {/* Decorative circles */}
      <circle cx={370} cy={260} r={110} fill="#e8e4db" opacity={0.55}/>
      <circle cx={30} cy={40} r={55} fill="#d9d4c8" opacity={0.35}/>

      {/* Desk surface */}
      <rect x={50} y={222} width={300} height={13} rx={6} fill="#d9d4c8"/>
      <rect x={76} y={235} width={10} height={50} rx={4} fill="#c6c0b1"/>
      <rect x={314} y={235} width={10} height={50} rx={4} fill="#c6c0b1"/>

      {/* Laptop base */}
      <rect x={90} y={196} width={168} height={26} rx={6} fill="#393935"/>
      <ellipse cx={174} cy={198} rx={10} ry={3.5} fill="#1c1b16"/>

      {/* Laptop screen */}
      <rect x={95} y={102} width={158} height={97} rx={8} fill="#393935"/>
      <rect x={102} y={109} width={144} height={84} rx={5} fill="#f6f4f0"/>

      {/* Resume content on screen */}
      <rect x={110} y={116} width={76} height={5.5} rx={2.5} fill="#1c1b16"/>
      <rect x={110} y={126} width={55} height={3.5} rx={1.75} fill="#4d4b44" opacity={0.7}/>
      <rect x={110} y={134} width={128} height={3} rx={1.5} fill="#d9d4c8"/>
      <rect x={110} y={140} width={108} height={3} rx={1.5} fill="#d9d4c8"/>
      <rect x={110} y={146} width={120} height={3} rx={1.5} fill="#d9d4c8"/>
      {/* Amber keyword highlight */}
      <rect x={122} y={134} width={32} height={3} rx={1.5} fill="#9d9884"/>
      {/* Section header */}
      <rect x={110} y={154} width={64} height={3.5} rx={1.75} fill="#1c1b16" opacity={0.6}/>
      <rect x={110} y={162} width={128} height={3} rx={1.5} fill="#d9d4c8"/>
      <rect x={110} y={168} width={96} height={3} rx={1.5} fill="#d9d4c8"/>
      <rect x={110} y={174} width={114} height={3} rx={1.5} fill="#d9d4c8"/>
      {/* Green keyword highlight */}
      <rect x={150} y={162} width={28} height={3} rx={1.5} fill="#bbb5a5"/>

      {/* Magnifying glass over keyword */}
      <circle cx={138} cy={135} r={12} fill="none" stroke="#9d9884" strokeWidth={2.5}/>
      <path d="M147 144 L153 150" stroke="#9d9884" strokeWidth={2.5} strokeLinecap="round"/>

      {/* Person — brown-skinned woman, dark hair, royal blue shirt */}
      {/* Chair back */}
      <rect x={298} y={195} width={64} height={42} rx={10} fill="#d9d4c8"/>
      {/* Body / shirt */}
      <path d="M300 196 Q300 224 332 224 Q364 224 364 196 Z" fill="#1c1b16"/>
      {/* Neck */}
      <rect x={324} y={180} width={17} height={18} rx={7} fill="#94907b"/>
      {/* Head */}
      <circle cx={332} cy={158} r={26} fill="#94907b"/>
      {/* Hair */}
      <path d="M306 158 Q306 132 332 132 Q358 132 358 152" fill="#12110d"/>
      <path d="M306 146 Q300 134 308 128" stroke="#12110d" strokeWidth={4} strokeLinecap="round" fill="none"/>
      {/* Hair bun */}
      <ellipse cx={360} cy={136} rx={9} ry={11} fill="#12110d"/>
      {/* Eyes */}
      <ellipse cx={324} cy={157} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={340} cy={157} rx={3} ry={3.5} fill="#12110d"/>
      {/* Smile */}
      <path d="M324 170 Q332 178 340 170" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Left arm — pointing at laptop */}
      <path d="M302 210 Q278 204 258 198" stroke="#94907b" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={252} cy={196} rx={10} ry={9} fill="#94907b"/>
      {/* Right arm — resting */}
      <path d="M362 208 Q378 218 384 228" stroke="#94907b" strokeWidth={13} strokeLinecap="round" fill="none"/>

      {/* ⚡ 12s badge */}
      <rect x={270} y={96} width={80} height={30} rx={15} fill="#1c1b16"/>
      <text x={310} y={116} textAnchor="middle" fontSize={13} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">⚡ 12s</text>

      {/* 94% match badge */}
      <rect x={52} y={94} width={94} height={26} rx={13} fill="#f8f6f2" stroke="#e9e5dd" strokeWidth={1.5}/>
      <text x={99} y={111} textAnchor="middle" fontSize={12} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">94% match ✓</text>

      {/* Sparkles */}
      <path d="M270 92 L273 84 L276 92 L268 95 Z" fill="#9d9884"/>
      <path d="M276 86 L273 84 L278 87 Z" fill="#9d9884" opacity={0.5}/>
      <path d="M56 188 L59 180 L62 188 L54 191 Z" fill="#bbb5a5" opacity={0.8}/>
      <path d="M380 152 L383 144 L386 152 L378 155 Z" fill="#4d4b44" opacity={0.6}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXTENSION — Browser form fields auto-filling with one click
// Placement: Features carousel slide 2
// ─────────────────────────────────────────────────────────────────────────────
export function IllustExtension({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#f8f6f2"/>
      <circle cx={370} cy={30} r={80} fill="#e8e4db" opacity={0.5}/>
      <circle cx={20} cy={260} r={90} fill="#e8e4db" opacity={0.35}/>

      {/* Browser window */}
      <rect x={22} y={32} width={232} height={202} rx={14} fill="white" stroke="#e4e0d6" strokeWidth={1.5}/>
      {/* Title bar */}
      <rect x={22} y={32} width={232} height={38} rx={14} fill="#f8f6f2"/>
      <rect x={22} y={56} width={232} height={14} fill="#f8f6f2"/>
      {/* Traffic lights */}
      <circle cx={42} cy={51} r={6} fill="#96927d"/>
      <circle cx={58} cy={51} r={6} fill="#c8c2b3"/>
      <circle cx={74} cy={51} r={6} fill="#ada896"/>
      {/* URL bar */}
      <rect x={90} y={43} width={140} height={16} rx={8} fill="white" stroke="#e8e4db" strokeWidth={1}/>
      <text x={160} y={54.5} textAnchor="middle" fontSize={9} fill="#a29d89" fontFamily="system-ui, sans-serif">greenhouse.io/apply</text>
      {/* Extension icon */}
      <rect x={241} y={43} width={22} height={16} rx={5} fill="#4d4b44"/>
      <text x={252} y={54} textAnchor="middle" fontSize={9} fontWeight={800} fill="white" fontFamily="system-ui, sans-serif">CK</text>

      {/* Form fields */}
      {/* Field 1: Name — filled */}
      <text x={33} y={86} fontSize={9} fontWeight={600} fill="#706c5c" fontFamily="system-ui, sans-serif">Full Name</text>
      <rect x={33} y={90} width={200} height={22} rx={6} fill="#f8f6f2" stroke="#e9e5dd" strokeWidth={1.5}/>
      <text x={43} y={105} fontSize={10} fill="#161510" fontFamily="system-ui, sans-serif">Eshwar Janjirala</text>
      <circle cx={221} cy={101} r={8} fill="#4d4b44"/>
      <path d="M215 101 L219 105 L227 96" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Field 2: Email — filled */}
      <text x={33} y={126} fontSize={9} fontWeight={600} fill="#706c5c" fontFamily="system-ui, sans-serif">Email</text>
      <rect x={33} y={130} width={200} height={22} rx={6} fill="#f8f6f2" stroke="#e9e5dd" strokeWidth={1.5}/>
      <text x={43} y={145} fontSize={10} fill="#161510" fontFamily="system-ui, sans-serif">eshwarjay0@gmail.com</text>
      <circle cx={221} cy={141} r={8} fill="#4d4b44"/>
      <path d="M215 141 L219 145 L227 136" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>

      {/* Field 3: Visa — animating in */}
      <text x={33} y={166} fontSize={9} fontWeight={600} fill="#706c5c" fontFamily="system-ui, sans-serif">Visa Status</text>
      <rect x={33} y={170} width={200} height={22} rx={6} fill="#e8e4db" stroke="#4d4b44" strokeWidth={1.5}/>
      <text x={43} y={185} fontSize={10} fill="#4d4b44" fontFamily="system-ui, sans-serif">Green Card (GC)</text>
      <circle cx={221} cy={181} r={8} fill="none" stroke="#4d4b44" strokeWidth={2} strokeDasharray="22 8"/>

      {/* Field 4: Resume — pending */}
      <text x={33} y={206} fontSize={9} fontWeight={600} fill="#d6d1c4" fontFamily="system-ui, sans-serif">Resume Upload</text>
      <rect x={33} y={210} width={200} height={22} rx={6} fill="white" stroke="#e8e4db" strokeWidth={1}/>
      <text x={43} y={225} fontSize={10} fill="#d6d1c4" fontFamily="system-ui, sans-serif">Attaching…</text>

      {/* Person — light skin, dark hair, green shirt */}
      {/* Body */}
      <path d="M318 250 Q318 284 348 284 Q378 284 378 250 Z" fill="#4d4b44"/>
      {/* Neck */}
      <rect x={340} y={232} width={17} height={20} rx={7} fill="#d4cec1"/>
      {/* Head */}
      <circle cx={348} cy={210} r={25} fill="#d4cec1"/>
      {/* Hair */}
      <path d="M323 210 Q323 185 348 185 Q373 185 373 205" fill="#1c1b15"/>
      {/* Eyes */}
      <ellipse cx={340} cy={209} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={356} cy={209} rx={3} ry={3.5} fill="#12110d"/>
      {/* Smile */}
      <path d="M340 223 Q348 231 356 223" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Arm reaching to extension button */}
      <path d="M320 258 Q292 238 266 204 Q256 190 252 175" stroke="#d4cec1" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={250} cy={171} rx={9} ry={8} fill="#d4cec1"/>
      {/* Click indicator */}
      <circle cx={250} cy={171} r={16} fill="#4d4b44" opacity={0.2}/>
      <circle cx={250} cy={171} r={10} fill="#4d4b44" opacity={0.15}/>

      {/* "1-click fill" badge */}
      <rect x={278} y={52} width={90} height={26} rx={13} fill="#4d4b44"/>
      <text x={323} y={69} textAnchor="middle" fontSize={12} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">1-click fill</text>

      {/* "50+ ATS" badge */}
      <rect x={282} y={86} width={80} height={22} rx={11} fill="white" stroke="#e4e0d6" strokeWidth={1.5}/>
      <text x={322} y={101} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4d4b44" fontFamily="system-ui, sans-serif">50+ ATS</text>

      {/* Sparkles */}
      <path d="M290 142 L293 134 L296 142 L288 145 Z" fill="#9d9884" opacity={0.9}/>
      <path d="M300 178 L303 170 L306 178 L298 181 Z" fill="#bbb5a5" opacity={0.8}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. JOB SEARCH — Find visa-sponsored jobs with filter cards floating around
// Placement: Features carousel slide 3
// ─────────────────────────────────────────────────────────────────────────────
export function IllustJobSearch({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#f6f4ef"/>
      <circle cx={200} cy={150} r={130} fill="#ece9e1" opacity={0.5}/>
      <circle cx={370} cy={60} r={60} fill="#e0dcd2" opacity={0.4}/>

      {/* Person — medium-brown skin, purple shirt, standing center-left */}
      {/* Legs */}
      <rect x={180} y={228} width={22} height={60} rx={10} fill="#3c3c37"/>
      <rect x={210} y={228} width={22} height={60} rx={10} fill="#3c3c37"/>
      {/* Shoes */}
      <rect x={175} y={280} width={30} height={12} rx={6} fill="#12110d"/>
      <rect x={208} y={280} width={30} height={12} rx={6} fill="#12110d"/>
      {/* Body */}
      <rect x={168} y={168} width={76} height={64} rx={18} fill="#4d4b44"/>
      {/* Neck */}
      <rect x={196} y={154} width={18} height={17} rx={7} fill="#94907b"/>
      {/* Head */}
      <circle cx={205} cy={132} r={26} fill="#94907b"/>
      {/* Hair */}
      <path d="M179 132 Q179 106 205 106 Q231 106 231 126" fill="#12110d"/>
      {/* Eyes */}
      <ellipse cx={197} cy={131} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={213} cy={131} rx={3} ry={3.5} fill="#12110d"/>
      {/* Big smile */}
      <path d="M197 145 Q205 154 213 145" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Left arm raised — pointing up */}
      <path d="M170 178 Q152 160 138 136 Q130 122 132 108" stroke="#94907b" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={133} cy={104} rx={9} ry={9} fill="#94907b"/>
      {/* Right arm — pointing right at job cards */}
      <path d="M242 178 Q260 168 278 162" stroke="#94907b" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={284} cy={160} rx={9} ry={8} fill="#94907b"/>

      {/* Job cards — floating around */}
      {/* Card 1 — top left (H-1B) */}
      <rect x={22} y={48} width={134} height={64} rx={10} fill="white" stroke="#e0dcd2" strokeWidth={1.5}/>
      <rect x={32} y={58} width={34} height={34} rx={7} fill="#ece9e1"/>
      <text x={49} y={80} textAnchor="middle" fontSize={14} fontFamily="system-ui, sans-serif">🔐</text>
      <rect x={74} y={62} width={64} height={7} rx={3.5} fill="#161510" opacity={0.85}/>
      <rect x={74} y={74} width={44} height={5} rx={2.5} fill="#a29d89"/>
      <rect x={74} y={84} width={36} height={16} rx={8} fill="#ece9e1"/>
      <text x={92} y={96} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">H-1B</text>

      {/* Card 2 — top right (GC) */}
      <rect x={244} y={32} width={134} height={64} rx={10} fill="white" stroke="#e4e0d6" strokeWidth={1.5}/>
      <rect x={254} y={42} width={34} height={34} rx={7} fill="#e8e4db"/>
      <text x={271} y={64} textAnchor="middle" fontSize={14} fontFamily="system-ui, sans-serif">☁️</text>
      <rect x={296} y={46} width={68} height={7} rx={3.5} fill="#161510" opacity={0.85}/>
      <rect x={296} y={58} width={48} height={5} rx={2.5} fill="#a29d89"/>
      <rect x={296} y={68} width={48} height={16} rx={8} fill="#e8e4db"/>
      <text x={320} y={80} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">Green Card</text>

      {/* Card 3 — bottom right (OPT) */}
      <rect x={264} y={184} width={118} height={60} rx={10} fill="white" stroke="#e2ded4" strokeWidth={1.5}/>
      <rect x={274} y={194} width={30} height={30} rx={7} fill="#ece9e1"/>
      <text x={289} y={214} textAnchor="middle" fontSize={13} fontFamily="system-ui, sans-serif">💻</text>
      <rect x={312} y={198} width={58} height={6} rx={3} fill="#161510" opacity={0.85}/>
      <rect x={312} y={208} width={42} height={5} rx={2.5} fill="#a29d89"/>
      <rect x={312} y={218} width={36} height={16} rx={8} fill="#ece9e1"/>
      <text x={330} y={230} textAnchor="middle" fontSize={9} fontWeight={700} fill="#58564c" fontFamily="system-ui, sans-serif">OPT/CPT</text>

      {/* Card 4 — bottom left (C2C) */}
      <rect x={18} y={196} width={118} height={60} rx={10} fill="white" stroke="#e4e0d6" strokeWidth={1.5}/>
      <rect x={28} y={206} width={30} height={30} rx={7} fill="#f6f4f0"/>
      <text x={43} y={226} textAnchor="middle" fontSize={13} fontFamily="system-ui, sans-serif">📊</text>
      <rect x={66} y={210} width={58} height={6} rx={3} fill="#161510" opacity={0.85}/>
      <rect x={66} y={220} width={40} height={5} rx={2.5} fill="#a29d89"/>
      <rect x={66} y={230} width={32} height={16} rx={8} fill="#f6f4f0"/>
      <text x={82} y={242} textAnchor="middle" fontSize={9} fontWeight={700} fill="#6b6858" fontFamily="system-ui, sans-serif">C2C</text>

      {/* Filter badge */}
      <rect x={148} y={38} width={108} height={26} rx={13} fill="#4d4b44"/>
      <text x={202} y={55} textAnchor="middle" fontSize={12} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Visa filter ON ✓</text>

      {/* Connection lines (dashed, person → cards) */}
      <path d="M133 104 Q80 90 89 112" stroke="#e0dcd2" strokeWidth={1.5} strokeDasharray="5 3" fill="none"/>
      <path d="M205 106 Q256 60 244 96" stroke="#e0dcd2" strokeWidth={1.5} strokeDasharray="5 3" fill="none"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TRACKER — Person at kanban board moving application to Offer
// Placement: Features carousel slide 4
// ─────────────────────────────────────────────────────────────────────────────
export function IllustTracker({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#f7f5f0"/>
      <circle cx={380} cy={260} r={100} fill="#f6f4f0" opacity={0.55}/>
      <circle cx={40} cy={40} r={55} fill="#e4e0d6" opacity={0.3}/>

      {/* Kanban board */}
      <rect x={100} y={52} width={280} height={196} rx={12} fill="white" stroke="#e4e0d6" strokeWidth={1.5}/>
      {/* Board header */}
      <rect x={100} y={52} width={280} height={32} rx={12} fill="#f7f5f0"/>
      <rect x={100} y={72} width={280} height={12} fill="#f7f5f0"/>
      <text x={240} y={72} textAnchor="middle" fontSize={11} fontWeight={700} fill="#58564c" fontFamily="system-ui, sans-serif">Applications Pipeline</text>

      {/* Column 1: Applied (blue) */}
      <rect x={112} y={92} width={78} height={148} rx={8} fill="#f2f0ea"/>
      <text x={151} y={108} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1c1b16" fontFamily="system-ui, sans-serif">📨 Applied</text>
      <rect x={118} y={114} width={66} height={32} rx={6} fill="white" stroke="#d9d4c8" strokeWidth={1}/>
      <text x={151} y={127} textAnchor="middle" fontSize={8} fontWeight={600} fill="#161510" fontFamily="system-ui, sans-serif">Palo Alto</text>
      <text x={151} y={139} textAnchor="middle" fontSize={7.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Cloud Sec Eng</text>
      <rect x={118} y={152} width={66} height={32} rx={6} fill="white" stroke="#d9d4c8" strokeWidth={1}/>
      <text x={151} y={165} textAnchor="middle" fontSize={8} fontWeight={600} fill="#161510" fontFamily="system-ui, sans-serif">Stripe</text>
      <text x={151} y={177} textAnchor="middle" fontSize={7.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Sr. SWE</text>
      <rect x={118} y={190} width={66} height={32} rx={6} fill="white" stroke="#d9d4c8" strokeWidth={1}/>
      <text x={151} y={203} textAnchor="middle" fontSize={8} fontWeight={600} fill="#161510" fontFamily="system-ui, sans-serif">Meta</text>
      <text x={151} y={215} textAnchor="middle" fontSize={7.5} fill="#706c5c" fontFamily="system-ui, sans-serif">ML Engineer</text>

      {/* Column 2: Interview (green) */}
      <rect x={198} y={92} width={78} height={148} rx={8} fill="#f8f6f2"/>
      <text x={237} y={108} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">📞 Interview</text>
      <rect x={204} y={114} width={66} height={32} rx={6} fill="white" stroke="#e9e5dd" strokeWidth={1}/>
      <text x={237} y={127} textAnchor="middle" fontSize={8} fontWeight={600} fill="#161510" fontFamily="system-ui, sans-serif">Databricks</text>
      <text x={237} y={139} textAnchor="middle" fontSize={7.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Data Engineer</text>
      <rect x={204} y={152} width={66} height={32} rx={6} fill="white" stroke="#e9e5dd" strokeWidth={1}/>
      <text x={237} y={165} textAnchor="middle" fontSize={8} fontWeight={600} fill="#161510" fontFamily="system-ui, sans-serif">CrowdStrike</text>
      <text x={237} y={177} textAnchor="middle" fontSize={7.5} fill="#706c5c" fontFamily="system-ui, sans-serif">DevSecOps</text>

      {/* Column 3: Offer (amber/gold) */}
      <rect x={284} y={92} width={84} height={148} rx={8} fill="#f7f5f0"/>
      <text x={326} y={108} textAnchor="middle" fontSize={9} fontWeight={700} fill="#6b6858" fontFamily="system-ui, sans-serif">🎉 Offer</text>
      {/* Trophy icon at top */}
      <text x={326} y={126} textAnchor="middle" fontSize={22} fontFamily="system-ui, sans-serif">🏆</text>
      {/* Card being placed (animated-feel, slightly tilted) */}
      <g transform="rotate(-3 326 160)">
        <rect x={292} y={142} width={68} height={40} rx={6} fill="#6b6858" opacity={0.95}/>
        <text x={326} y={158} textAnchor="middle" fontSize={8} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">$185k offer!</text>
        <text x={326} y={174} textAnchor="middle" fontSize={7.5} fill="#e4e0d6" fontFamily="system-ui, sans-serif">Databricks ✓</text>
      </g>
      <text x={326} y={222} textAnchor="middle" fontSize={9} fill="#6b6858" fontFamily="system-ui, sans-serif" fontWeight={600}>+2 more</text>

      {/* Person — dark-skinned man, amber shirt, left side */}
      {/* Legs */}
      <rect x={32} y={220} width={20} height={68} rx={9} fill="#34342f"/>
      <rect x={58} y={220} width={20} height={68} rx={9} fill="#34342f"/>
      {/* Shoes */}
      <rect x={26} y={278} width={28} height={12} rx={6} fill="#12110d"/>
      <rect x={54} y={278} width={28} height={12} rx={6} fill="#12110d"/>
      {/* Body */}
      <rect x={20} y={156} width={72} height={70} rx={18} fill="#6b6858"/>
      {/* Neck */}
      <rect x={46} y={142} width={16} height={17} rx={7} fill="#605e51"/>
      {/* Head */}
      <circle cx={54} cy={120} r={26} fill="#605e51"/>
      {/* Hair (short, dark) */}
      <path d="M28 120 Q28 94 54 94 Q80 94 80 114" fill="#12110d"/>
      {/* Eyes */}
      <ellipse cx={46} cy={119} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={62} cy={119} rx={3} ry={3.5} fill="#12110d"/>
      {/* Big smile */}
      <path d="M46 133 Q54 142 62 133" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Right arm — extended pointing at the board / moving card */}
      <path d="M90 172 Q110 168 130 164 Q156 160 178 156" stroke="#605e51" strokeWidth={15} strokeLinecap="round" fill="none"/>
      <ellipse cx={184} cy={154} rx={10} ry={9} fill="#605e51"/>
      {/* Left arm */}
      <path d="M22 168 Q10 178 6 192" stroke="#605e51" strokeWidth={14} strokeLinecap="round" fill="none"/>

      {/* Sparkles — celebration */}
      <path d="M292 56 L295 48 L298 56 L290 59 Z" fill="#9d9884"/>
      <path d="M350 48 L353 40 L356 48 L348 51 Z" fill="#7e7a68"/>
      <path d="M370 82 L373 74 L376 82 L368 85 Z" fill="#bbb5a5" opacity={0.8}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANALYTICS — Person beside bar chart showing callback rates
// Placement: Features carousel slide 5
// ─────────────────────────────────────────────────────────────────────────────
export function IllustAnalytics({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#f6f4ef"/>
      <circle cx={50} cy={260} r={100} fill="#f1eee8" opacity={0.5}/>
      <circle cx={380} cy={50} r={70} fill="#f1eee8" opacity={0.4}/>

      {/* Bar chart background */}
      <rect x={42} y={62} width={226} height={192} rx={12} fill="white" stroke="#f1eee8" strokeWidth={1.5}/>
      <text x={155} y={80} textAnchor="middle" fontSize={10} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">Callback Rate by Resume</text>

      {/* Grid lines */}
      <path d="M60 96 L252 96" stroke="#f1eee8" strokeWidth={1}/>
      <path d="M60 126 L252 126" stroke="#f1eee8" strokeWidth={1}/>
      <path d="M60 156 L252 156" stroke="#f1eee8" strokeWidth={1}/>
      <path d="M60 186 L252 186" stroke="#f1eee8" strokeWidth={1}/>
      <path d="M60 216 L252 216" stroke="#f1eee8" strokeWidth={1} strokeDasharray="0"/>
      {/* Y axis */}
      <path d="M60 90 L60 220" stroke="#f1eee8" strokeWidth={1}/>

      {/* Bar 1 — AppSec (tallest, teal) */}
      <rect x={72} y={114} width={36} height={102} rx={5} fill="#5c5a4e" opacity={0.85}/>
      <text x={90} y={110} textAnchor="middle" fontSize={10} fontWeight={700} fill="#5c5a4e" fontFamily="system-ui, sans-serif">42%</text>
      {/* Medal on top */}
      <circle cx={90} cy={100} r={10} fill="#9d9884"/>
      <text x={90} y={104} textAnchor="middle" fontSize={10} fontFamily="system-ui, sans-serif">🥇</text>
      <text x={90} y={234} textAnchor="middle" fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">AppSec</text>

      {/* Bar 2 — Cloud (teal mid) */}
      <rect x={120} y={140} width={36} height={76} rx={5} fill="#5c5a4e" opacity={0.65}/>
      <text x={138} y={136} textAnchor="middle" fontSize={10} fontWeight={700} fill="#5c5a4e" fontFamily="system-ui, sans-serif">28%</text>
      <text x={138} y={234} textAnchor="middle" fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Cloud</text>

      {/* Bar 3 — OT Sec (teal light) */}
      <rect x={168} y={158} width={36} height={58} rx={5} fill="#5c5a4e" opacity={0.5}/>
      <text x={186} y={154} textAnchor="middle" fontSize={10} fontWeight={700} fill="#5c5a4e" fontFamily="system-ui, sans-serif">19%</text>
      <text x={186} y={234} textAnchor="middle" fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">OT Sec</text>

      {/* Bar 4 — ServiceNow (lighter) */}
      <rect x={216} y={174} width={30} height={42} rx={5} fill="#5c5a4e" opacity={0.35}/>
      <text x={231} y={170} textAnchor="middle" fontSize={10} fontWeight={700} fill="#5c5a4e" fontFamily="system-ui, sans-serif">12%</text>
      <text x={231} y={234} textAnchor="middle" fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">SNOW</text>

      {/* Trend arrow */}
      <path d="M72 180 Q110 160 138 148 Q166 140 186 132 Q216 118 248 100" stroke="#5c5a4e" strokeWidth={2} strokeDasharray="5 3" fill="none"/>
      <path d="M244 96 L252 100 L246 106 Z" fill="#5c5a4e"/>

      {/* Person — medium-brown skin, teal shirt */}
      {/* Legs */}
      <rect x={302} y={228} width={20} height={60} rx={9} fill="#42413c"/>
      <rect x={328} y={228} width={20} height={60} rx={9} fill="#42413c"/>
      {/* Body */}
      <rect x={288} y={164} width={72} height={70} rx={18} fill="#5c5a4e"/>
      {/* Neck */}
      <rect x={314} y={150} width={16} height={17} rx={7} fill="#94907b"/>
      {/* Head */}
      <circle cx={322} cy={128} r={26} fill="#94907b"/>
      {/* Hair */}
      <path d="M296 128 Q296 102 322 102 Q348 102 348 122" fill="#1c1b15"/>
      {/* Eyes */}
      <ellipse cx={314} cy={127} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={330} cy={127} rx={3} ry={3.5} fill="#12110d"/>
      {/* Excited smile */}
      <path d="M314 141 Q322 150 330 141" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Right arm raised + pointing at chart */}
      <path d="M288 174 Q268 160 254 140 Q244 126 240 110" stroke="#94907b" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={238} cy={106} rx={9} ry={9} fill="#94907b"/>
      {/* Left arm at side */}
      <path d="M358 174 Q370 186 374 202" stroke="#94907b" strokeWidth={13} strokeLinecap="round" fill="none"/>

      {/* "3× callbacks" badge */}
      <rect x={290} y={88} width={96} height={28} rx={14} fill="#5c5a4e"/>
      <text x={338} y={106} textAnchor="middle" fontSize={13} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">3× callbacks</text>

      {/* Sparkles */}
      <path d="M366 164 L369 156 L372 164 L364 167 Z" fill="#9d9884" opacity={0.9}/>
      <path d="M378 128 L381 120 L384 128 L376 131 Z" fill="#9d9884" opacity={0.7}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GMAIL — Never miss a recruiter email — person getting message
// Placement: Features carousel slide 6
// ─────────────────────────────────────────────────────────────────────────────
export function IllustGmail({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={300} fill="#fdfcf9"/>
      <circle cx={380} cy={270} r={100} fill="#e6e2d9" opacity={0.5}/>
      <circle cx={30} cy={50} r={60} fill="#e6e2d9" opacity={0.35}/>

      {/* Person — light skin, red shirt, holding phone */}
      {/* Body */}
      <rect x={34} y={168} width={72} height={70} rx={18} fill="#13120d"/>
      {/* Neck */}
      <rect x={60} y={153} width={16} height={17} rx={7} fill="#e2ded4"/>
      {/* Head */}
      <circle cx={68} cy={131} r={26} fill="#e2ded4"/>
      {/* Hair — medium brown */}
      <path d="M42 131 Q42 105 68 105 Q94 105 94 125" fill="#666355"/>
      {/* Eyes */}
      <ellipse cx={60} cy={130} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={76} cy={130} rx={3} ry={3.5} fill="#12110d"/>
      {/* Excited open-mouth smile */}
      <path d="M60 144 Q68 154 76 144" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Phone in right hand */}
      <path d="M104 176 Q118 166 132 158" stroke="#e2ded4" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <rect x={128} y={134} width={28} height={46} rx={7} fill="#161510"/>
      <rect x={131} y={138} width={22} height={34} rx={4} fill="#fdfcf9"/>
      {/* Notification dot on phone */}
      <circle cx={153} cy={138} r={7} fill="#13120d"/>
      <text x={153} y={141.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">2</text>
      {/* Left arm */}
      <path d="M36 178 Q24 188 20 202" stroke="#e2ded4" strokeWidth={14} strokeLinecap="round" fill="none"/>

      {/* Floating email cards */}
      {/* Email 1 — recruiter from Palo Alto */}
      <rect x={172} y={44} width={198} height={72} rx={12} fill="white" stroke="#e6e2d9" strokeWidth={1.5}/>
      <rect x={184} y={54} width={36} height={36} rx={10} fill="#e6e2d9"/>
      <text x={202} y={77} textAnchor="middle" fontSize={20} fontFamily="system-ui, sans-serif">📧</text>
      <text x={228} y={68} fontSize={9.5} fontWeight={700} fill="#161510" fontFamily="system-ui, sans-serif">Sarah Chen • Palo Alto Networks</text>
      <text x={228} y={81} fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Hi Eshwar, congrats! You're moving to</text>
      <text x={228} y={93} fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">the final interview round! 🎉</text>
      <rect x={310} y={54} width={48} height={16} rx={8} fill="#e6e2d9"/>
      <text x={334} y={65} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#13120d" fontFamily="system-ui, sans-serif">New ●</text>

      {/* Email 2 — recruiter from CrowdStrike */}
      <rect x={188} y={132} width={190} height={64} rx={12} fill="white" stroke="#e6e2d9" strokeWidth={1.5}/>
      <rect x={198} y={142} width={30} height={30} rx={8} fill="#e6e2d9"/>
      <text x={213} y={162} textAnchor="middle" fontSize={16} fontFamily="system-ui, sans-serif">📩</text>
      <text x={236} y={155} fontSize={9} fontWeight={700} fill="#161510" fontFamily="system-ui, sans-serif">Alex Torres • CrowdStrike</text>
      <text x={236} y={167} fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">Your Kubernetes background caught</text>
      <text x={236} y={179} fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">my eye — quick intro call? ☎</text>
      <rect x={340} y={142} width={26} height={16} rx={8} fill="#e6e2d9"/>
      <text x={353} y={153} textAnchor="middle" fontSize={8} fontWeight={700} fill="#13120d" fontFamily="system-ui, sans-serif">●</text>

      {/* Email 3 — Databricks (success) */}
      <rect x={172} y={212} width={198} height={56} rx={12} fill="#f8f6f2" stroke="#e9e5dd" strokeWidth={1.5}/>
      <rect x={182} y={222} width={28} height={28} rx={7} fill="#e8e4db"/>
      <text x={196} y={240} textAnchor="middle" fontSize={14} fontFamily="system-ui, sans-serif">🎉</text>
      <text x={218} y={236} fontSize={9} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">Databricks Offer Letter</text>
      <text x={218} y={248} fontSize={8.5} fill="#706c5c" fontFamily="system-ui, sans-serif">$185k + equity • Green Card</text>
      <rect x={310} y={222} width={48} height={16} rx={8} fill="#e8e4db"/>
      <text x={334} y={233} textAnchor="middle" fontSize={8} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">Offer ✓</text>

      {/* "AI Reply" badge */}
      <rect x={174} y={282} width={80} height={22} rx={11} fill="#13120d"/>
      <text x={214} y={296} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">AI Reply ✦</text>

      {/* Sparkles */}
      <path d="M162 64 L165 56 L168 64 L160 67 Z" fill="#9d9884" opacity={0.8}/>
      <path d="M158 108 L161 100 L164 108 L156 111 Z" fill="#7e7a68" opacity={0.7}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LIBRARY EMPTY STATE — Person holding a glowing resume document
// Placement: Resume page library empty state
// ─────────────────────────────────────────────────────────────────────────────
export function IllustLibrary({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={320} height={240} rx={16} fill="#f2f0ea"/>
      <circle cx={160} cy={240} r={120} fill="#e8e4db" opacity={0.45}/>
      <circle cx={280} cy={40} r={50} fill="#e8e4db" opacity={0.3}/>

      {/* Resume document */}
      <rect x={156} y={64} width={118} height={152} rx={10} fill="white" stroke="#d9d4c8" strokeWidth={2}/>
      {/* Document glow */}
      <rect x={156} y={64} width={118} height={152} rx={10} fill="#1c1b16" opacity={0.04}/>
      {/* Doc header */}
      <rect x={166} y={76} width={72} height={5} rx={2.5} fill="#1c1b16"/>
      <rect x={166} y={85} width={52} height={3.5} rx={1.75} fill="#4d4b44" opacity={0.7}/>
      <rect x={166} y={94} width={98} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={100} width={84} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={106} width={92} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={115} width={52} height={3.5} rx={1.75} fill="#1c1b16" opacity={0.6}/>
      <rect x={166} y={123} width={98} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={129} width={76} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={135} width={88} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={144} width={52} height={3.5} rx={1.75} fill="#1c1b16" opacity={0.6}/>
      <rect x={166} y={152} width={98} height={2.5} rx={1.25} fill="#d9d4c8"/>
      <rect x={166} y={158} width={80} height={2.5} rx={1.25} fill="#d9d4c8"/>
      {/* Cert badge on doc */}
      <rect x={166} y={170} width={48} height={14} rx={7} fill="#e8e4db"/>
      <text x={190} y={180} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">OSCP ✓</text>
      <rect x={220} y={170} width={44} height={14} rx={7} fill="#ece9e1"/>
      <text x={242} y={180} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#4d4b44" fontFamily="system-ui, sans-serif">AZ-500</text>

      {/* Person — brown skin woman, blue shirt */}
      {/* Right arm (holding doc from right) */}
      <path d="M152 148 Q170 138 172 110" stroke="#94907b" strokeWidth={12} strokeLinecap="round" fill="none"/>
      <ellipse cx={173} cy={105} rx={8} ry={8} fill="#94907b"/>
      {/* Body */}
      <rect x={54} y={152} width={72} height={72} rx={18} fill="#1c1b16"/>
      {/* Neck */}
      <rect x={82} y={138} width={16} height={17} rx={7} fill="#94907b"/>
      {/* Head */}
      <circle cx={90} cy={116} r={26} fill="#94907b"/>
      {/* Hair */}
      <path d="M64 116 Q64 90 90 90 Q116 90 116 110" fill="#12110d"/>
      {/* Hair bun detail */}
      <ellipse cx={117} cy={95} rx={8} ry={9} fill="#12110d"/>
      {/* Eyes */}
      <ellipse cx={82} cy={115} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={98} cy={115} rx={3} ry={3.5} fill="#12110d"/>
      {/* Proud smile */}
      <path d="M82 129 Q90 138 98 129" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Left arm (holding doc from left) */}
      <path d="M56 162 Q80 152 150 148" stroke="#94907b" strokeWidth={12} strokeLinecap="round" fill="none"/>
      <ellipse cx={154} cy={148} rx={8} ry={7} fill="#94907b"/>

      {/* Star rating badge on document */}
      <rect x={174} y={48} width={82} height={22} rx={11} fill="#9d9884"/>
      <text x={215} y={63} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">⭐ ATS Ready</text>

      {/* Sparkles */}
      <path d="M150 56 L153 48 L156 56 L148 59 Z" fill="#9d9884" opacity={0.9}/>
      <path d="M144 68 L147 60 L150 68 L142 71 Z" fill="#9d9884" opacity={0.5}/>
      <path d="M268 144 L271 136 L274 144 L266 147 Z" fill="#9d9884" opacity={0.8}/>
      <path d="M276 106 L279 98 L282 106 L274 109 Z" fill="#bbb5a5" opacity={0.7}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BUILDER — Person constructing a resume at a virtual desk
// Placement: Resume builder section header / empty state
// ─────────────────────────────────────────────────────────────────────────────
export function IllustBuilder({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={320} height={240} rx={16} fill="#f7f5f1"/>
      <circle cx={280} cy={220} r={90} fill="#f2f0ea" opacity={0.55}/>
      <circle cx={40} cy={50} r={50} fill="#e7e3da" opacity={0.35}/>

      {/* Desk */}
      <rect x={28} y={184} width={264} height={12} rx={5} fill="#e6e2d9"/>
      <rect x={48} y={196} width={8} height={38} rx={3} fill="#d3cdc0"/>
      <rect x={264} y={196} width={8} height={38} rx={3} fill="#d3cdc0"/>

      {/* Large document being built */}
      <rect x={118} y={62} width={148} height={126} rx={10} fill="white" stroke="#e6e2d9" strokeWidth={1.5}/>
      {/* Section labels on document */}
      <rect x={126} y={72} width={64} height={5} rx={2.5} fill="#514f47"/>
      <text x={160} y={86} textAnchor="middle" fontSize={8} fontWeight={700} fill="#9d9884" fontFamily="system-ui, sans-serif">SUMMARY</text>
      <rect x={126} y={90} width={132} height={3} rx={1.5} fill="#e6e2d9"/>
      <rect x={126} y={96} width={116} height={3} rx={1.5} fill="#e6e2d9"/>
      <rect x={126} y={102} width={124} height={3} rx={1.5} fill="#e6e2d9"/>
      {/* Experience section */}
      <rect x={126} y={113} width={52} height={4} rx={2} fill="#514f47" opacity={0.7}/>
      <text x={160} y={125} textAnchor="middle" fontSize={8} fontWeight={700} fill="#9d9884" fontFamily="system-ui, sans-serif">EXPERIENCE</text>
      <rect x={126} y={129} width={132} height={2.5} rx={1.25} fill="#e6e2d9"/>
      <rect x={126} y={135} width={110} height={2.5} rx={1.25} fill="#e6e2d9"/>
      <rect x={126} y={141} width={120} height={2.5} rx={1.25} fill="#e6e2d9"/>
      {/* Skills */}
      <rect x={126} y={151} width={44} height={4} rx={2} fill="#514f47" opacity={0.5}/>
      <text x={148} y={163} textAnchor="middle" fontSize={8} fontWeight={700} fill="#9d9884" fontFamily="system-ui, sans-serif">SKILLS</text>
      <rect x={126} y={167} width={38} height={10} rx={5} fill="#ece9e1"/>
      <rect x={170} y={167} width={34} height={10} rx={5} fill="#ece9e1"/>
      <rect x={210} y={167} width={42} height={10} rx={5} fill="#ece9e1"/>

      {/* Pencil drawing on document */}
      <g transform="rotate(-35 165 130)">
        <rect x={106} y={120} width={8} height={38} rx={3} fill="#9d9884"/>
        <path d="M106 158 L110 165 L114 158 Z" fill="#12110d"/>
        <rect x={108} y={117} width={4} height={5} fill="#ccc6b7"/>
      </g>

      {/* Ruler */}
      <rect x={30} y={156} width={72} height={10} rx={3} fill="#d3cdc0"/>
      <path d="M38 156 L38 162" stroke="white" strokeWidth={1}/>
      <path d="M46 156 L46 160" stroke="white" strokeWidth={1}/>
      <path d="M54 156 L54 162" stroke="white" strokeWidth={1}/>
      <path d="M62 156 L62 160" stroke="white" strokeWidth={1}/>
      <path d="M70 156 L70 162" stroke="white" strokeWidth={1}/>
      <path d="M78 156 L78 160" stroke="white" strokeWidth={1}/>
      <path d="M86 156 L86 162" stroke="white" strokeWidth={1}/>
      <path d="M94 156 L94 160" stroke="white" strokeWidth={1}/>

      {/* Person — dark-skinned man, indigo shirt, left side */}
      {/* Body */}
      <rect x={24} y={148} width={72} height={42} rx={18} fill="#514f47"/>
      {/* Neck */}
      <rect x={52} y={134} width={16} height={16} rx={7} fill="#605e51"/>
      {/* Head */}
      <circle cx={60} cy={112} r={24} fill="#605e51"/>
      {/* Hair */}
      <path d="M36 112 Q36 88 60 88 Q84 88 84 108" fill="#12110d"/>
      {/* Eyes */}
      <ellipse cx={52} cy={111} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={68} cy={111} rx={3} ry={3.5} fill="#12110d"/>
      {/* Focused expression */}
      <path d="M52 125 Q60 131 68 125" stroke="#12110d" strokeWidth={2} strokeLinecap="round" fill="none"/>
      {/* Glasses */}
      <rect x={46} y={105} width={14} height={10} rx={3} fill="none" stroke="#12110d" strokeWidth={1.5}/>
      <rect x={62} y={105} width={14} height={10} rx={3} fill="none" stroke="#12110d" strokeWidth={1.5}/>
      <path d="M60 110 L62 110" stroke="#12110d" strokeWidth={1.5}/>
      {/* Right arm — holding pencil toward doc */}
      <path d="M94 158 Q108 152 116 144" stroke="#605e51" strokeWidth={13} strokeLinecap="round" fill="none"/>
      {/* Left arm */}
      <path d="M26 156 Q14 166 10 180" stroke="#605e51" strokeWidth={12} strokeLinecap="round" fill="none"/>

      {/* "Resume Builder" header badge */}
      <rect x={120} y={40} width={110} height={22} rx={11} fill="#514f47"/>
      <text x={175} y={55} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Build Resume ✦</text>

      {/* Sparkles */}
      <path d="M260 72 L263 64 L266 72 L258 75 Z" fill="#9d9884" opacity={0.8}/>
      <path d="M278 100 L281 92 L284 100 L276 103 Z" fill="#514f47" opacity={0.6}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. APPLICATIONS — Person launching applications toward companies
// Placement: Applications page header / empty state
// ─────────────────────────────────────────────────────────────────────────────
export function IllustApplications({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={260} rx={16} fill="#f2f0ea"/>
      <circle cx={350} cy={220} r={100} fill="#e8e4db" opacity={0.4}/>
      <circle cx={60} cy={60} r={55} fill="#e8e4db" opacity={0.3}/>

      {/* Pipeline track */}
      <path d="M100 200 Q200 175 300 200" stroke="#d9d4c8" strokeWidth={3} strokeDasharray="8 5" fill="none"/>

      {/* Stage labels */}
      <rect x={48} y={188} width={52} height={18} rx={9} fill="#1c1b16"/>
      <text x={74} y={200} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Applied</text>
      <rect x={174} y={164} width={52} height={18} rx={9} fill="#4d4b44"/>
      <text x={200} y={176} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Interview</text>
      <rect x={298} y={188} width={52} height={18} rx={9} fill="#6b6858"/>
      <text x={324} y={200} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Offer 🎉</text>

      {/* Company building icons */}
      {/* Company 1 */}
      <rect x={300} y={120} width={56} height={56} rx={10} fill="white" stroke="#d9d4c8" strokeWidth={1.5}/>
      <text x={328} y={153} textAnchor="middle" fontSize={24} fontFamily="system-ui, sans-serif">🏢</text>

      {/* Company 2 */}
      <rect x={226} y={100} width={50} height={50} rx={10} fill="white" stroke="#d9d4c8" strokeWidth={1.5}/>
      <text x={251} y={131} textAnchor="middle" fontSize={22} fontFamily="system-ui, sans-serif">🌐</text>

      {/* Company 3 */}
      <rect x={174} y={80} width={46} height={46} rx={10} fill="white" stroke="#d9d4c8" strokeWidth={1.5}/>
      <text x={197} y={109} textAnchor="middle" fontSize={20} fontFamily="system-ui, sans-serif">💼</text>

      {/* Paper plane 1 — to company 1 */}
      <g transform="rotate(-20 130 160)">
        <path d="M130 160 L148 150 L136 168 Z" fill="#1c1b16"/>
        <path d="M136 168 L132 165 L134 156 Z" fill="#1c1b16" opacity={0.5}/>
      </g>
      <path d="M128 162 Q200 130 294 136" stroke="#1c1b16" strokeWidth={1.5} strokeDasharray="5 3" fill="none" opacity={0.5}/>

      {/* Paper plane 2 — to company 2 */}
      <g transform="rotate(-35 118 150)">
        <path d="M118 150 L136 138 L124 156 Z" fill="#4d4b44"/>
        <path d="M124 156 L120 153 L122 144 Z" fill="#4d4b44" opacity={0.5}/>
      </g>
      <path d="M116 150 Q168 118 220 112" stroke="#4d4b44" strokeWidth={1.5} strokeDasharray="5 3" fill="none" opacity={0.5}/>

      {/* Paper plane 3 — to company 3 */}
      <g transform="rotate(-48 106 142)">
        <path d="M106 142 L124 128 L112 146 Z" fill="#4d4b44"/>
        <path d="M112 146 L108 143 L110 134 Z" fill="#4d4b44" opacity={0.5}/>
      </g>
      <path d="M104 142 Q138 100 170 96" stroke="#4d4b44" strokeWidth={1.5} strokeDasharray="5 3" fill="none" opacity={0.5}/>

      {/* Person — peach skin, blue shirt, throwing */}
      {/* Legs */}
      <rect x={38} y={216} width={20} height={36} rx={9} fill="#393935"/>
      <rect x={64} y={216} width={20} height={36} rx={9} fill="#393935"/>
      {/* Body */}
      <rect x={26} y={156} width={72} height={64} rx={18} fill="#1c1b16"/>
      {/* Neck */}
      <rect x={54} y={142} width={16} height={17} rx={7} fill="#e2ded4"/>
      {/* Head */}
      <circle cx={62} cy={120} r={26} fill="#e2ded4"/>
      {/* Hair (golden) */}
      <path d="M36 120 Q36 94 62 94 Q88 94 88 114" fill="#a7a290"/>
      {/* Ears */}
      <ellipse cx={36} cy={122} rx={6} ry={7} fill="#e2ded4"/>
      <ellipse cx={88} cy={122} rx={6} ry={7} fill="#e2ded4"/>
      {/* Eyes */}
      <ellipse cx={54} cy={119} rx={3} ry={3.5} fill="#12110d"/>
      <ellipse cx={70} cy={119} rx={3} ry={3.5} fill="#12110d"/>
      {/* Smile */}
      <path d="M54 133 Q62 142 70 133" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Right arm — throwing motion, raised */}
      <path d="M96 164 Q112 148 128 138" stroke="#e2ded4" strokeWidth={14} strokeLinecap="round" fill="none"/>
      <ellipse cx={132} cy={136} rx={9} ry={8} fill="#e2ded4"/>
      {/* Left arm */}
      <path d="M28 168 Q16 178 12 194" stroke="#e2ded4" strokeWidth={13} strokeLinecap="round" fill="none"/>

      {/* "18 apps sent" badge */}
      <rect x={26} y={68} width={82} height={24} rx={12} fill="#1c1b16"/>
      <text x={67} y={84} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">18 apps sent</text>

      {/* Confetti dots */}
      <circle cx={350} cy={90} r={5} fill="#9d9884"/>
      <circle cx={364} cy={72} r={4} fill="#4d4b44" opacity={0.8}/>
      <circle cx={342} cy={68} r={3.5} fill="#4d4b44"/>
      <circle cx={370} cy={106} r={4} fill="#13120d" opacity={0.7}/>
      <path d="M358 50 L361 42 L364 50 L356 53 Z" fill="#9d9884" opacity={0.9}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ANALYTICS HERO — Funnel chart with candidate celebrating at bottom
// Placement: Analytics page header section
// ─────────────────────────────────────────────────────────────────────────────
export function IllustAnalyticsHero({ className, style }: IllustProps) {
  return (
    <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}>
      <rect width={400} height={260} rx={16} fill="#f6f4ef"/>
      <circle cx={200} cy={100} r={150} fill="#f1eee8" opacity={0.35}/>
      <circle cx={370} cy={240} r={80} fill="#f1eee8" opacity={0.4}/>

      {/* Funnel chart */}
      {/* Level 1 — Applied (widest) */}
      <rect x={60} y={36} width={280} height={40} rx={8} fill="#1c1b16" opacity={0.9}/>
      <text x={200} y={61} textAnchor="middle" fontSize={12} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Applied — 48 roles</text>

      {/* Level 2 — Screening */}
      <rect x={90} y={86} width={220} height={36} rx={7} fill="#5c5a4e" opacity={0.9}/>
      <text x={200} y={109} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Screening — 16 calls</text>

      {/* Level 3 — Interview */}
      <rect x={120} y={132} width={160} height={32} rx={6} fill="#4d4b44" opacity={0.9}/>
      <text x={200} y={153} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Interviews — 6</text>

      {/* Level 4 — Offer (narrowest) */}
      <rect x={150} y={174} width={100} height={28} rx={5} fill="#6b6858" opacity={0.95}/>
      <text x={200} y={193} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui, sans-serif">Offer 🎉 — 1</text>

      {/* Conversion rates on right */}
      <text x={324} y={58} fontSize={9.5} fill="#4d4b44" fontWeight={600} fontFamily="system-ui, sans-serif">100%</text>
      <text x={324} y={108} fontSize={9.5} fill="#4d4b44" fontWeight={600} fontFamily="system-ui, sans-serif">33%</text>
      <text x={324} y={150} fontSize={9.5} fill="#4d4b44" fontWeight={600} fontFamily="system-ui, sans-serif">13%</text>
      <text x={324} y={192} fontSize={9.5} fill="#6b6858" fontWeight={700} fontFamily="system-ui, sans-serif">2% → 🏆</text>

      {/* Person — medium skin, teal shirt, celebrating below funnel */}
      {/* Body */}
      <rect x={168} y={218} width={64} height={34} rx={16} fill="#5c5a4e"/>
      {/* Neck */}
      <rect x={192} y={206} width={14} height={14} rx={6} fill="#94907b"/>
      {/* Head */}
      <circle cx={199} cy={190} r={20} fill="#94907b"/>
      {/* Hair */}
      <path d="M179 190 Q179 170 199 170 Q219 170 219 186" fill="#1c1b15"/>
      {/* Eyes (excited/squinting) */}
      <path d="M192 189 Q195 186 198 189" stroke="#12110d" strokeWidth={2} strokeLinecap="round" fill="none"/>
      <path d="M200 189 Q203 186 206 189" stroke="#12110d" strokeWidth={2} strokeLinecap="round" fill="none"/>
      {/* Big smile */}
      <path d="M192 200 Q199 208 206 200" stroke="#12110d" strokeWidth={2.5} strokeLinecap="round" fill="none"/>
      {/* Arms raised in celebration */}
      <path d="M170 224 Q154 210 142 196 Q136 188 140 178" stroke="#94907b" strokeWidth={12} strokeLinecap="round" fill="none"/>
      <path d="M230 224 Q246 210 258 196 Q264 188 260 178" stroke="#94907b" strokeWidth={12} strokeLinecap="round" fill="none"/>
      <ellipse cx={140} cy={176} rx={8} ry={7} fill="#94907b"/>
      <ellipse cx={260} cy={176} rx={8} ry={7} fill="#94907b"/>

      {/* Confetti */}
      <circle cx={140} cy={166} r={5} fill="#9d9884"/>
      <circle cx={260} cy={162} r={5} fill="#9d9884"/>
      <circle cx={122} cy={182} r={4} fill="#4d4b44" opacity={0.8}/>
      <circle cx={276} cy={178} r={4} fill="#13120d" opacity={0.7}/>
      <path d="M132 148 L135 140 L138 148 L130 151 Z" fill="#9d9884" opacity={0.9}/>
      <path d="M264 146 L267 138 L270 146 L262 149 Z" fill="#9d9884" opacity={0.9}/>
      <path d="M36 164 L39 156 L42 164 L34 167 Z" fill="#5c5a4e" opacity={0.7}/>
      <path d="M362 154 L365 146 L368 154 L360 157 Z" fill="#4d4b44" opacity={0.7}/>

      {/* "Your offer rate" label */}
      <rect x={28} y={174} width={104} height={28} rx={14} fill="white" stroke="#f1eee8" strokeWidth={1.5}/>
      <text x={80} y={192} textAnchor="middle" fontSize={11} fontWeight={600} fill="#4d4b44" fontFamily="system-ui, sans-serif">Offer rate: 2%</text>

      {/* Career growth arrow */}
      <path d="M28 56 L36 42 L44 56" stroke="#5c5a4e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M36 42 L36 72" stroke="#5c5a4e" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  )
}
