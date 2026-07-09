// CareerOS — Shared Resume Library
// Source of truth for all resume variants used in both the extension and dashboard.

const RESUMES = [
  {
    id: 'ot-security-gc',
    name: 'Eshwar Janjirala',
    role: 'OT Security Engineer',
    visa: 'GC · C2C',
    category: 'C2C / GC / AI',
    email: 'eshwarjay06@gmail.com',
    phone: '(314) 255-9156',
    linkedin: 'linkedin.com/in/eshwarjay',
    isSecurityRole: true,
    keywords: ['OT security','operational technology','ICS','SCADA','Industrial Defender','Dragos','Claroty','NERC CIP','NIST 800-82','ISA/IEC 62443','MITRE ATT&CK','OSCP','AZ-500','PenTest+','CySA+','SIEM','SOC','DFIR','incident response','threat detection','Splunk','Sentinel','EDR','network security','vulnerability','penetration testing','industrial','control systems','substations','energy','critical infrastructure','firewall','segmentation','Palo Alto','QRadar','forensics'],
    summary: 'OT Security Engineer with 5+ years securing industrial control systems and critical infrastructure. Specializing in ICS/SCADA security, threat detection, and NERC CIP compliance across energy and healthcare sectors.',
    certifications: ['OSCP (Oct 2024)', 'AZ-500 (Jan 2025)', 'CompTIA PenTest+ (Jan 2024)', 'CySA+ (Feb 2024)'],
    skills: {
      'OT/ICS Security': ['Industrial Defender', 'Dragos', 'Claroty', 'NERC CIP', 'ISA/IEC 62443', 'NIST 800-82', 'SCADA'],
      'SIEM / SOAR': ['Splunk', 'Microsoft Sentinel', 'XSOAR', 'QRadar'],
      'Frameworks': ['MITRE ATT&CK for ICS', 'NIST CSF', 'ISO 27001'],
      'Cloud': ['Azure', 'AWS Security Hub'],
      'Scripting': ['Python', 'PowerShell', 'Bash']
    },
    experience: [
      {
        employer: 'Cigna Healthcare', title: 'OT Security Analyst',
        dates: 'Jul 2023 – Present', location: 'Remote',
        bullets: [
          'Deployed Dragos Platform across ~12 ICS/SCADA sites, reducing mean time to detect OT threats from 72hrs to under 8hrs',
          'Led NERC CIP compliance assessments for 3 substations, achieving 100% audit pass rate across CIP-002 through CIP-014',
          'Built MITRE ATT&CK for ICS threat model covering 40+ adversary techniques, integrated with Sentinel for automated alerting',
          'Responded to ~85 OT security incidents quarterly, driving MTTR down ~34% through playbook standardization',
          'Architected IT/OT network segmentation using Palo Alto NGFWs and ISA/IEC 62443 zone/conduit model'
        ]
      },
      {
        employer: 'Citi Bank', title: 'SOC Analyst / DFIR',
        dates: 'Jan 2019 – Jun 2022', location: 'New York, NY',
        bullets: [
          'Investigated 200+ security incidents annually using Splunk SIEM, reducing false positives ~28% via custom detection rules',
          'Performed digital forensics on 30+ compromised endpoints using FTK and Volatility, supporting 5 legal/HR investigations',
          'Developed IR playbooks for ransomware, phishing, and insider threat scenarios used by a team of 12 analysts',
          'Operationalized 50+ STIX/TAXII threat intel feeds into QRadar for proactive IOC blocking'
        ]
      }
    ],
    education: 'MS Computer Science, Saint Louis University | Aug 2022 – May 2024'
  },
  {
    id: 'servicenow-gc-remote',
    name: 'Eshwar Jay',
    role: 'Senior ServiceNow Developer / Admin',
    visa: 'GC · Remote',
    category: 'CYBER / GC Remote',
    email: 'eshwarjay05@gmail.com',
    phone: '(314) 255-9156',
    linkedin: 'linkedin.com/in/eshwarjay',
    isSecurityRole: false,
    keywords: ['ServiceNow','ITSM','ITOM','GRC','HR Service Delivery','FlowDesigner','Service Catalog','Business Rules','Script Includes','REST','SOAP','PDI','ATF','JavaScript','Glide API','CMDB','Change Management','Incident Management','Problem Management','SLAs','workflow','integration','Workday','SAP','Salesforce','ITIL','discovery','configuration management','onboarding','automation','platform','admin','xanadu','tokyo','utah','vancouver'],
    summary: 'Senior ServiceNow Developer/Admin with 10+ years architecting and delivering ITSM, ITOM, and GRC solutions for Fortune 500 enterprises. Expert in FlowDesigner, Service Catalog, and complex REST/SOAP integrations across healthcare and financial verticals.',
    certifications: ['ServiceNow Certified System Administrator', 'ServiceNow Certified Application Developer', 'ITIL v4 Foundation'],
    skills: {
      'ServiceNow Modules': ['ITSM', 'ITOM', 'GRC', 'HR Service Delivery', 'CSM', 'CMDB', 'Discovery'],
      'Development': ['FlowDesigner', 'Business Rules', 'Script Includes', 'Client Scripts', 'UI Actions', 'Service Catalog'],
      'Integration': ['REST API', 'SOAP', 'MID Server', 'Import Sets', 'Transform Maps'],
      'Testing / Analytics': ['ATF (Automated Test Framework)', 'Performance Analytics', 'PDI'],
      'Languages': ['JavaScript', 'Glide API', 'AngularJS', 'HTML/CSS']
    },
    experience: [
      {
        employer: 'Deloitte', title: 'Senior ServiceNow Developer',
        dates: 'Mar 2021 – Present', location: 'Remote',
        bullets: [
          'Architected and delivered 4 ServiceNow ITSM implementations for healthcare and financial clients, reducing ticket resolution time ~35%',
          'Built 20+ FlowDesigner workflows automating onboarding, procurement, and change management — saving ~800 hrs/month',
          'Developed REST integrations between ServiceNow and Workday, SAP, and Salesforce handling ~15,000 daily API transactions',
          'Led ATF test suite of 150+ tests achieving 95% code coverage across 6 ServiceNow releases (Tokyo through Xanadu)',
          'Mentored 5 junior developers in Glide API, Script Includes, and ServiceNow best practices'
        ]
      },
      {
        employer: 'Accenture', title: 'ServiceNow Admin / Developer',
        dates: 'Jun 2018 – Feb 2021', location: 'Chicago, IL',
        bullets: [
          'Administered ServiceNow platform for 8,000-user enterprise maintaining 99.9% uptime and SLA compliance',
          'Delivered GRC module with 60+ policy controls and automated evidence collection, cutting audit prep time ~50%',
          'Migrated legacy Remedy ticketing system to ServiceNow including 200K+ historical records with zero data loss',
          'Configured ITOM Discovery for 3,500-node CMDB achieving ~90% CI relationship accuracy'
        ]
      }
    ],
    education: 'B.Tech Computer Science, JNTUH India | Jun 2011 – May 2015'
  },
  {
    id: 'appsec-cyber-gc',
    name: 'Eshwar Jay',
    role: 'Senior Security Engineer — AppSec / Cyber',
    visa: 'GC · W2',
    category: 'CYBER / GC / APPSEC',
    email: 'jayeshwar24@gmail.com',
    phone: '+1 (646) 820-3671',
    linkedin: 'linkedin.com/in/jayy-eshwar',
    isSecurityRole: true,
    keywords: ['AppSec','application security','SAST','DAST','SCA','Burp Suite','Fortify','Snyk','Invicti','OWASP Top 10','threat modeling','SDLC','DevSecOps','DLP','CyberArk','CrowdStrike','Netskope','Zscaler','Qualys','Wiz','DefectDojo','Azure AKS','CISSP','CCSK','penetration testing','vulnerability management','cloud security','container security','CI/CD','pipeline','microservices','SOC 2','ISO 27001','PAM','IAM','SailPoint','Okta','secure coding'],
    summary: 'Senior Security Engineer with 8+ years specializing in Application Security and Cloud Security across SDLC integration, threat modeling, and DevSecOps pipelines. CISSP certified with deep expertise in SAST/DAST tooling, DLP, and PAM solutions.',
    certifications: ['CISSP', 'CCSK', 'CompTIA PenTest+', 'CySA+', 'Security+', 'OSCP', 'CFE (pursuing)'],
    skills: {
      'AppSec / SAST/DAST': ['Burp Suite Pro', 'Fortify', 'Snyk', 'Invicti', 'DefectDojo', 'OWASP ZAP'],
      'Cloud Security': ['Wiz', 'Prisma Cloud', 'Azure AKS', 'AWS Security Hub', 'Zscaler', 'Netskope'],
      'Identity / PAM': ['CyberArk', 'SailPoint', 'Okta', 'Azure AD'],
      'Endpoint / EDR': ['CrowdStrike Falcon', 'Carbon Black', 'Qualys VMDR'],
      'Frameworks': ['OWASP Top 10', 'MITRE ATT&CK', 'NIST CSF', 'ISO 27001', 'SOC 2']
    },
    experience: [
      {
        employer: 'JPMorgan Chase', title: 'Senior Application Security Engineer',
        dates: 'Apr 2022 – Present', location: 'New York, NY',
        bullets: [
          'Integrated Snyk and Fortify into 35+ CI/CD pipelines (GitHub Actions, Jenkins), blocking ~1,200 critical vulnerabilities from production over 18 months',
          'Led threat modeling for 12 microservices on Azure AKS, identifying 28 high-severity design flaws pre-deployment',
          'Built DefectDojo vulnerability management platform processing 8,000+ findings/month with automated deduplication',
          'Implemented CyberArk PAM for 500+ privileged accounts in compliance with SOX requirements',
          'Conducted 20+ web app pen tests using Burp Suite Pro, uncovering OWASP Top 10 critical findings across financial APIs'
        ]
      },
      {
        employer: 'Cognizant', title: 'Security Engineer — DevSecOps',
        dates: 'Aug 2019 – Mar 2022', location: 'Remote',
        bullets: [
          'Deployed Zscaler ZTNA replacing legacy VPN for 4,000 users, improving access security while reducing latency ~40%',
          'Implemented Microsoft Purview DLP across M365, preventing ~300 sensitive data exfiltration incidents monthly',
          'Ran Snyk SCA scanning across 80+ repos, reducing open-source vulnerability backlog from 2,400 to under 200 in 6 months',
          'Delivered AppSec training for 150 developers covering OWASP Top 10, secure coding, and threat modeling'
        ]
      }
    ],
    education: 'B.Tech Computer Science, JNTUH India | Jun 2011 – May 2015'
  },
  {
    id: 'devops-gc-c2c',
    name: 'Eshwar Jay',
    role: 'Senior DevOps / Cloud Engineer',
    visa: 'GC · C2C',
    category: 'C2C / GC / DevOps',
    email: 'eshwarjay0@gmail.com',
    phone: '(314) 255-9156',
    linkedin: 'linkedin.com/in/eshwarjay',
    isSecurityRole: false,
    keywords: ['DevOps','Kubernetes','Docker','Terraform','Ansible','Jenkins','GitHub Actions','GitLab CI','CI/CD','AWS','Azure','GCP','Helm','ArgoCD','Prometheus','Grafana','ELK','Linux','Python','Bash','infrastructure as code','cloud','microservices','SRE','reliability','EKS','AKS','GKE','CloudFormation','Pulumi','Istio','observability','monitoring','alerting','deployment','pipeline','container','orchestration'],
    summary: 'Senior DevOps/Cloud Engineer with 7+ years building and scaling cloud-native infrastructure. Expert in Kubernetes orchestration, IaC with Terraform, and CI/CD pipeline automation across AWS and Azure enterprise environments.',
    certifications: ['AWS Solutions Architect – Professional', 'CKA (Certified Kubernetes Administrator)', 'HashiCorp Terraform Associate'],
    skills: {
      'Orchestration': ['Kubernetes (EKS/AKS/GKE)', 'Docker', 'Helm', 'ArgoCD', 'Istio'],
      'IaC': ['Terraform', 'Ansible', 'CloudFormation', 'Pulumi'],
      'CI/CD': ['Jenkins', 'GitHub Actions', 'GitLab CI', 'Azure DevOps'],
      'Cloud Platforms': ['AWS', 'Azure', 'GCP'],
      'Monitoring': ['Prometheus', 'Grafana', 'ELK Stack', 'Datadog', 'PagerDuty']
    },
    experience: [],
    education: 'MS Computer Science, Saint Louis University | Aug 2022 – May 2024'
  },
  {
    id: 'fsd-gc-c2c',
    name: 'Eshwar Jay',
    role: 'Senior Full Stack Developer',
    visa: 'GC · C2C',
    category: 'C2C / GC / FSD',
    email: 'eshwarjay0@gmail.com',
    phone: '(314) 255-9156',
    linkedin: 'linkedin.com/in/eshwarjay',
    isSecurityRole: false,
    keywords: ['React','Node.js','TypeScript','JavaScript','Next.js','GraphQL','REST API','PostgreSQL','MongoDB','Redis','AWS','Docker','full stack','frontend','backend','microservices','agile','Python','Django','FastAPI','Vue','Angular','HTML','CSS','Tailwind','Express','Jest','Cypress','CI/CD','web application','SPA','API design','unit testing'],
    summary: 'Senior Full Stack Developer with 8+ years building scalable web applications. Expert in React/Next.js frontends and Node.js/Python backends with strong AWS deployment and CI/CD pipeline experience.',
    certifications: ['AWS Developer Associate', 'MongoDB Certified Developer'],
    skills: {
      'Frontend': ['React', 'Next.js', 'TypeScript', 'Vue.js', 'Tailwind CSS'],
      'Backend': ['Node.js', 'Python', 'Django', 'FastAPI', 'GraphQL'],
      'Database': ['PostgreSQL', 'MongoDB', 'Redis', 'DynamoDB'],
      'Cloud / DevOps': ['AWS', 'Docker', 'GitHub Actions', 'Kubernetes'],
      'Testing': ['Jest', 'Cypress', 'pytest', 'Playwright']
    },
    experience: [],
    education: 'MS Computer Science, Saint Louis University | Aug 2022 – May 2024'
  },
  {
    id: 'grc-cyber-gc',
    name: 'Eshwar Jay',
    role: 'GRC Analyst / Security Compliance Engineer',
    visa: 'GC · W2',
    category: 'CYBER / GC / GRC',
    email: 'jayeshwar24@gmail.com',
    phone: '+1 (646) 820-3671',
    linkedin: 'linkedin.com/in/jayy-eshwar',
    isSecurityRole: true,
    keywords: ['GRC','governance','risk','compliance','SOC 2','ISO 27001','NIST CSF','HIPAA','PCI DSS','FedRAMP','audit','risk assessment','policy','controls','vendor risk','third-party risk','FISMA','GDPR','data privacy','CISA','CRISC','security program','framework','gap analysis','BCP','DR','business continuity','evidence collection','control testing','risk management','regulatory'],
    summary: 'GRC Analyst with 6+ years developing and managing security compliance programs across NIST CSF, SOC 2, and ISO 27001 frameworks for regulated industries including healthcare and financial services.',
    certifications: ['CISSP', 'CISA', 'CRISC', 'CompTIA Security+'],
    skills: {
      'Frameworks': ['NIST CSF', 'SOC 2 Type II', 'ISO 27001', 'PCI DSS', 'HIPAA', 'FedRAMP'],
      'GRC Tools': ['ServiceNow GRC', 'Archer', 'OneTrust', 'Tugboat Logic', 'Drata'],
      'Risk Management': ['Risk Assessment', 'Vendor Risk Management', 'BCP/DR', 'Business Impact Analysis'],
      'Audit': ['Internal Audit', 'Evidence Collection', 'Control Testing', 'Gap Analysis']
    },
    experience: [],
    education: 'B.Tech Computer Science, JNTUH India | Jun 2011 – May 2015'
  }
];
