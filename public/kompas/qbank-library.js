/* Kompas Question Bank: the built-in library. Loaded before qbank.js.

   The owner, 12 Oct 2026: "On the suggestions while entering title and company keep it empty when user is entering.
   load about 300 to 400 general entries for helping user to finish them like software engineer data analyst etc etc;
   And companies apple, comcast etc; And also find question banks with common questions and answers of these companies
   keep them all in Question Bank."

   Three things live here and nothing else: the lists that finish a job title or a company as it is typed, the thirty
   questions asked in almost every interview, and a set of practice questions for each company whose way of interviewing
   is public.

   THE MISTAKE THIS FILE MUST NOT MAKE is to pass a guess off as a record. Nothing below claims "this was asked at X".
   A company's set is built on something that company itself publishes (its principles, its values, how it says it
   interviews), and `basis` says which, in words the person is shown. Where a company publishes nothing of the kind, the
   set says it is what a company of that sort usually asks. Each question carries what a strong answer shows, not an
   answer: the answer has to be the person's own, from their own work. */
(() => {
  /* ---- job titles: the common ones, and the usual levels of the ones that have levels ---- */
  const LEVELLED = ["Software Engineer", "Frontend Engineer", "Backend Engineer", "Full Stack Engineer", "Mobile Engineer", "DevOps Engineer",
    "Site Reliability Engineer", "Cloud Engineer", "Platform Engineer", "Data Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer",
    "Security Engineer", "Security Analyst", "QA Engineer", "Network Engineer", "Systems Engineer", "Product Manager", "Product Designer",
    "Business Analyst", "Financial Analyst", "Project Manager", "Program Manager", "Solutions Architect"];
  // A level is offered only where the job has it: every one of these has a senior, the ten below have a lead, and the
  // ladder with a staff and a principal rung is spelled out once.
  const LEADS = ["Software Engineer", "Data Engineer", "Data Scientist", "Data Analyst", "DevOps Engineer", "Site Reliability Engineer", "Security Engineer", "Product Manager", "Product Designer", "Solutions Architect"];
  const LADDER = ["Junior Software Engineer", "Staff Software Engineer", "Principal Software Engineer"];
  const TITLES = `Software Developer|Web Developer|iOS Developer|Android Developer|Java Developer|Python Developer|.NET Developer|JavaScript Developer|React Developer|Node.js Developer|PHP Developer|C++ Developer|Go Developer|Ruby on Rails Developer|Salesforce Developer|ServiceNow Developer|SAP Consultant|WordPress Developer|Game Developer|Embedded Software Engineer|Firmware Engineer|Software Architect|Engineering Manager|Director of Engineering|VP of Engineering|Chief Technology Officer|Technical Lead|Software Development Engineer in Test|Test Automation Engineer|Release Engineer|Build Engineer|Kubernetes Engineer|Cloud Architect|AWS Engineer|Azure Engineer|Infrastructure Engineer|Systems Administrator|Linux Administrator|Windows Administrator|Database Administrator|Database Developer|SQL Developer|ETL Developer|Business Intelligence Developer|Business Intelligence Analyst|Analytics Engineer|Data Architect|Data Governance Analyst|Research Scientist|Applied Scientist|AI Engineer|Generative AI Engineer|Prompt Engineer|MLOps Engineer|Computer Vision Engineer|NLP Engineer|Quantitative Analyst|Statistician|Cybersecurity Engineer|Cybersecurity Analyst|SOC Analyst|Incident Responder|Threat Intelligence Analyst|Penetration Tester|Application Security Engineer|Cloud Security Engineer|Identity and Access Management Engineer|GRC Analyst|IT Auditor|Information Security Manager|Chief Information Security Officer|Security Architect|Vulnerability Management Analyst|Detection Engineer|IT Support Specialist|Help Desk Technician|Desktop Support Technician|IT Manager|IT Director|IT Project Manager|Network Administrator|Network Architect|Telecommunications Engineer|Technical Support Engineer|Technical Account Manager|Customer Support Engineer|Sales Engineer|Solutions Engineer|Technical Writer|Developer Advocate|Scrum Master|Agile Coach|Technical Program Manager|Product Owner|Product Marketing Manager|Product Analyst|Director of Product|Chief Product Officer|UX Designer|UI Designer|UX Researcher|Interaction Designer|Visual Designer|Graphic Designer|Motion Designer|Content Designer|Design Manager|Creative Director|Art Director|Brand Designer|Web Designer|Business Systems Analyst|Operations Analyst|Management Consultant|Strategy Consultant|Strategy Analyst|Business Development Manager|Business Development Representative|Operations Manager|Director of Operations|Chief Operating Officer|General Manager|Chief of Staff|Executive Assistant|Administrative Assistant|Office Manager|Receptionist|Accountant|Senior Accountant|Staff Accountant|Accounts Payable Specialist|Accounts Receivable Specialist|Bookkeeper|Auditor|Internal Auditor|Tax Accountant|Tax Analyst|Controller|Finance Manager|FP&A Analyst|Investment Analyst|Investment Banking Analyst|Private Equity Associate|Portfolio Manager|Risk Analyst|Credit Analyst|Compliance Analyst|Compliance Officer|Actuary|Underwriter|Claims Adjuster|Loan Officer|Financial Advisor|Treasury Analyst|Payroll Specialist|Chief Financial Officer|Account Executive|Account Manager|Sales Representative|Sales Development Representative|Inside Sales Representative|Sales Manager|Regional Sales Manager|Director of Sales|Customer Success Manager|Customer Service Representative|Call Center Agent|Client Services Manager|Relationship Manager|Marketing Manager|Marketing Coordinator|Marketing Specialist|Digital Marketing Manager|Content Marketing Manager|Content Writer|Copywriter|Editor|SEO Specialist|Social Media Manager|Growth Marketing Manager|Email Marketing Specialist|Brand Manager|Public Relations Specialist|Communications Manager|Event Coordinator|Market Research Analyst|Recruiter|Technical Recruiter|Talent Acquisition Specialist|HR Generalist|HR Manager|HR Business Partner|People Operations Manager|Compensation Analyst|Learning and Development Specialist|Training Manager|Supply Chain Analyst|Supply Chain Manager|Logistics Coordinator|Procurement Specialist|Buyer|Purchasing Manager|Warehouse Manager|Warehouse Associate|Inventory Analyst|Demand Planner|Production Planner|Fleet Manager|Truck Driver|Delivery Driver|Mechanical Engineer|Electrical Engineer|Civil Engineer|Structural Engineer|Chemical Engineer|Industrial Engineer|Manufacturing Engineer|Process Engineer|Quality Engineer|Quality Assurance Analyst|Aerospace Engineer|Biomedical Engineer|Environmental Engineer|Hardware Engineer|Controls Engineer|Robotics Engineer|Field Service Engineer|Maintenance Technician|Electrician|HVAC Technician|Plumber|Welder|Machinist|Construction Manager|Project Engineer|Architect|Interior Designer|Estimator|Safety Manager|Registered Nurse|Nurse Practitioner|Licensed Practical Nurse|Medical Assistant|Physician Assistant|Physician|Pharmacist|Pharmacy Technician|Physical Therapist|Occupational Therapist|Dental Hygienist|Dental Assistant|Medical Coder|Medical Biller|Healthcare Administrator|Clinical Research Coordinator|Clinical Research Associate|Laboratory Technician|Radiologic Technologist|Paramedic|Home Health Aide|Caregiver|Social Worker|Mental Health Counselor|Psychologist|Veterinary Technician|Teacher|Elementary School Teacher|High School Teacher|Special Education Teacher|Teaching Assistant|Substitute Teacher|Professor|Lecturer|Instructional Designer|School Counselor|Academic Advisor|Tutor|Librarian|Paralegal|Legal Assistant|Attorney|Corporate Counsel|Contract Manager|Policy Analyst|Grant Writer|Program Coordinator|Nonprofit Program Manager|Research Assistant|Research Analyst|Economist|Journalist|Video Editor|Photographer|Producer|Translator|Real Estate Agent|Property Manager|Insurance Agent|Bank Teller|Personal Banker|Branch Manager|Store Manager|Assistant Store Manager|Retail Sales Associate|Cashier|Merchandiser|Visual Merchandiser|Restaurant Manager|Chef|Line Cook|Server|Bartender|Barista|Hotel Front Desk Agent|Housekeeper|Flight Attendant|Pilot|Security Guard|Police Officer|Firefighter|Personal Trainer|Intern|Software Engineering Intern|Data Science Intern|Marketing Intern`.split("|");
  const titles = [...new Set([...LEVELLED, ...LEVELLED.map(t => "Senior " + t), ...LEADS.map(t => "Lead " + t), ...LADDER, ...TITLES])];

  /* ---- companies: large employers people apply to, in no order of merit ---- */
  const companies = [...new Set(`Apple|Microsoft|Google|Amazon|Meta|Netflix|Nvidia|Tesla|IBM|Oracle|Salesforce|Adobe|Intel|AMD|Cisco|Qualcomm|Broadcom|Dell Technologies|HP|Hewlett Packard Enterprise|Lenovo|Samsung|Sony|LG|Texas Instruments|Micron|Applied Materials|ServiceNow|Workday|SAP|Snowflake|Databricks|Palantir|Stripe|Block|PayPal|Shopify|Uber|Lyft|Airbnb|DoorDash|Instacart|Spotify|Pinterest|Snap|Reddit|LinkedIn|X|TikTok|ByteDance|Zoom|Slack|Atlassian|Dropbox|Box|Twilio|Okta|CrowdStrike|Palo Alto Networks|Fortinet|Zscaler|Cloudflare|Datadog|Splunk|MongoDB|Elastic|GitHub|GitLab|Red Hat|VMware|Nutanix|Intuit|Autodesk|Electronic Arts|Activision Blizzard|Epic Games|Roblox|Unity|OpenAI|Anthropic|Scale AI|Figma|Canva|Notion|Airtable|HubSpot|Zendesk|DocuSign|Square|Robinhood|Coinbase|Chime|SoFi|Affirm|Plaid|Comcast|NBCUniversal|Charter Communications|Verizon|AT&T|T-Mobile|Cox Communications|Dish Network|Lumen Technologies|Disney|Warner Bros. Discovery|Paramount|Fox Corporation|The New York Times|Bloomberg|Thomson Reuters|JPMorgan Chase|Bank of America|Wells Fargo|Citi|Goldman Sachs|Morgan Stanley|Capital One|American Express|Visa|Mastercard|Discover|U.S. Bank|PNC|Truist|Charles Schwab|Fidelity Investments|Vanguard|BlackRock|State Street|BNY Mellon|Northern Trust|Citadel|Two Sigma|Jane Street|Bridgewater Associates|Blackstone|KKR|Berkshire Hathaway|Prudential|MetLife|State Farm|Allstate|Progressive|Liberty Mutual|Travelers|USAA|Nationwide|Aflac|Cigna|UnitedHealth Group|Optum|Elevance Health|Humana|CVS Health|Aetna|Kaiser Permanente|HCA Healthcare|Mayo Clinic|Cleveland Clinic|Johns Hopkins Medicine|Ascension|CommonSpirit Health|Walgreens|McKesson|Cardinal Health|Cencora|Johnson & Johnson|Pfizer|Merck|AbbVie|Eli Lilly|Bristol Myers Squibb|Amgen|Gilead Sciences|Moderna|Novartis|Roche|Genentech|AstraZeneca|GSK|Sanofi|Bayer|Abbott|Medtronic|Boston Scientific|Stryker|Thermo Fisher Scientific|Danaher|GE HealthCare|Philips|Siemens|McKinsey & Company|Boston Consulting Group|Bain & Company|Deloitte|PwC|EY|KPMG|Accenture|Booz Allen Hamilton|Capgemini|Cognizant|Infosys|Tata Consultancy Services|Wipro|HCLTech|Tech Mahindra|Slalom|Gartner|Walmart|Target|Costco|Kroger|Albertsons|Publix|Home Depot|Lowe's|Best Buy|Macy's|Nordstrom|Kohl's|TJX|Ross Stores|Dollar General|Dollar Tree|Wayfair|eBay|Etsy|Chewy|IKEA|Nike|Adidas|Lululemon|Gap|Levi Strauss|Under Armour|Procter & Gamble|Unilever|Colgate-Palmolive|Kimberly-Clark|PepsiCo|Coca-Cola|Nestle|Mondelez|Kraft Heinz|General Mills|Kellanova|Mars|Tyson Foods|Starbucks|McDonald's|Chipotle|Yum! Brands|Domino's|Darden Restaurants|Marriott|Hilton|Hyatt|Booking Holdings|Expedia|Delta Air Lines|United Airlines|American Airlines|Southwest Airlines|JetBlue|Alaska Airlines|FedEx|UPS|DHL|U.S. Postal Service|Union Pacific|BNSF Railway|CSX|J.B. Hunt|Ford|General Motors|Stellantis|Toyota|Honda|Nissan|Hyundai|BMW|Mercedes-Benz|Volkswagen|Rivian|Lucid Motors|Waymo|Cruise|Boeing|Lockheed Martin|RTX|Northrop Grumman|General Dynamics|L3Harris|BAE Systems|SpaceX|Blue Origin|NASA|Leidos|SAIC|CACI|General Electric|GE Aerospace|GE Vernova|Honeywell|3M|Caterpillar|John Deere|Emerson|Eaton|Schneider Electric|ABB|Cummins|Parker Hannifin|Otis|Carrier|Whirlpool|ExxonMobil|Chevron|Shell|BP|ConocoPhillips|Schlumberger|Halliburton|Duke Energy|Southern Company|NextEra Energy|Dominion Energy|Exelon|Dow|DuPont|Corning|Network Rail|National Grid|Rolls-Royce|HSBC|Barclays|Lloyds Banking Group|Deutsche Bank|UBS|BNP Paribas|Santander|RBC|TD Bank|Scotiabank|Tesco|Vodafone|BT Group|Ericsson|Nokia|Internal Revenue Service|Department of Veterans Affairs|Department of Defense|Social Security Administration|Federal Reserve|Harvard University|Stanford University|Massachusetts Institute of Technology|University of California`.split("|"))];

  /* ---- the thirty asked almost everywhere: [category, question, what a strong answer shows] ---- */
  const common = [
    ["Experience", "Tell me about yourself.", "What you do now, what led to it, and why this role is next: about a minute, and it ends on this job."],
    ["Experience", "Walk me through your resume.", "One line of reasoning through your moves, with the reason for each, ending at where you are now."],
    ["Motivation", "Why do you want to work here?", "One specific thing about this company's work, tied to something you have actually done."],
    ["Motivation", "Why do you want this role?", "What draws you to the work itself, and how it follows from what you have been doing."],
    ["Motivation", "Why are you leaving your current job?", "What you want more of next. Never a complaint about a person."],
    ["Motivation", "Why should we hire you?", "The three things the job post asks for, each matched to something you have done."],
    ["Experience", "What are your greatest strengths?", "Two strengths this job needs, each with a short proof from real work."],
    ["Behavioral", "What is your greatest weakness?", "A real one, what it once cost you, and what you do now to keep it in hand."],
    ["Motivation", "Where do you see yourself in five years?", "Growth in the direction this role leads, not a different job somewhere else."],
    ["Experience", "What accomplishment are you most proud of?", "One result with a number in it, and exactly which part was yours."],
    ["Experience", "What is the hardest problem you have solved?", "Why it was hard, what you tried first, what worked, and how you knew."],
    ["Behavioral", "Tell me about a time you faced a conflict at work.", "You raised it with the person directly, and the work carried on afterwards."],
    ["Behavioral", "Tell me about a time you disagreed with your manager.", "You disagreed with reasons, listened, and then stood behind the decision."],
    ["Behavioral", "Tell me about a time you failed.", "You name your own part plainly and show what you changed because of it."],
    ["Behavioral", "Tell me about a time you made a mistake.", "You caught it or owned it early, fixed it, and stopped it happening again."],
    ["Behavioral", "Tell me about a time you showed leadership.", "People followed your reasoning. You did not need to be the manager."],
    ["Behavioral", "Tell me about a time you worked under pressure.", "You put the work in order, cut scope on purpose, and told people early."],
    ["Behavioral", "Tell me about a time you worked on a team to reach a goal.", "Your own part is clear, and so is how you made the others' work easier."],
    ["Behavioral", "Tell me about a difficult colleague or customer.", "You stayed with the problem and not the person, and something got better."],
    ["Behavioral", "Tell me about a time you went beyond what the job required.", "You saw something that needed doing, did it, and it mattered to someone."],
    ["Behavioral", "Tell me about a time you had to learn something quickly.", "You have a way of learning, and you used it on real work with a deadline."],
    ["Behavioral", "Tell me about a decision you made without all the information.", "What you knew, what you assumed, and how you kept the risk small."],
    ["Behavioral", "Tell me about a time you improved a process.", "What was slow or broken, what you changed, and the before and after."],
    ["Situational", "How do you prioritize when everything is urgent?", "You sort by what it costs to be late, say what will wait, and tell whoever is waiting."],
    ["Situational", "How do you handle feedback you disagree with?", "You look for what is true in it first, ask a question, then act on it."],
    ["Situational", "What would you do in your first 90 days here?", "Listen and learn first, one early useful result, then a plan agreed with your manager."],
    ["Experience", "How do you like to be managed?", "What helps you do your best work, said so that a manager could act on it."],
    ["Motivation", "What motivates you?", "Something true that this job contains, with one example of it in your past work."],
    ["Motivation", "What are your salary expectations?", "A researched range for this role in this place, said calmly, open on the whole offer."],
    ["Motivation", "Do you have any questions for us?", "Two or three real ones: about the work, the team, and how success here is judged."],
  ];

  /* ---- by company: `basis` is what the set is built on, shown to the person. [category, question, what a strong answer shows, what it tests] ---- */
  const sets = {
    "Amazon": { basis: "Built on Amazon's published Leadership Principles.", questions: [
      ["Behavioral", "Tell me about a time you went out of your way for a customer.", "You started from the customer and worked backwards, even when it cost you effort.", "Customer Obsession"],
      ["Behavioral", "Tell me about a time you took on something outside your area because it needed doing.", "You never said \"that is not my job\", and you saw it through.", "Ownership"],
      ["Behavioral", "Tell me about a time you had to dig into the details to find the real cause.", "You went to the data yourself and found what the summary was hiding.", "Dive Deep"],
      ["Behavioral", "Tell me about a decision you made quickly with limited data.", "You judged it could be undone, moved, and checked the result.", "Bias for Action"],
      ["Behavioral", "Tell me about a time you disagreed with a decision. What did you do once it was made?", "You argued your case with respect, then committed fully.", "Have Backbone; Disagree and Commit"],
      ["Behavioral", "Tell me about a goal you delivered despite a serious setback.", "The obstacle is real, the result has a number, and the result was yours.", "Deliver Results"],
    ] },
    "Google": { basis: "Built on the four things Google says it hires for: how you think, what you know for the role, leadership, and how you work with others.", questions: [
      ["Situational", "Here is a problem you have not seen before. Talk me through how you would approach it.", "You ask what is being asked, break it down aloud, and check your own answer.", "How you think"],
      ["Technical", "What is the hardest technical problem you have solved in your field? What would you do differently now?", "Depth in your own area, and honest judgment of your past choices.", "Knowledge for the role"],
      ["Behavioral", "Tell me about a time you led an effort without being the manager.", "You stepped in when it was needed and stepped back when it was not.", "Leadership"],
      ["Behavioral", "Tell me about a time the goal or the owner was unclear. What did you do?", "You made progress in the fog and made it clearer for others.", "Comfort with ambiguity"],
      ["Behavioral", "Tell me about a time you changed your mind because of evidence.", "You held your view loosely and said so when you were wrong.", "Working with others"],
      ["Situational", "How would you measure whether something you built was a success?", "You choose a measure that follows from the goal, and name what it misses.", "How you think"],
    ] },
    "Meta": { basis: "Built on Meta's published values.", questions: [
      ["Behavioral", "Tell me about a time you moved fast. What did you give up to do it?", "You chose speed knowingly and can name the cost.", "Move fast"],
      ["Experience", "Which project of yours had the most impact? How did you know?", "Impact shown with a measure, and your part in it is plain.", "Focus on long-term impact"],
      ["Behavioral", "Tell me about a time you gave a colleague direct feedback they did not want.", "You were plain and kind in the same conversation.", "Be direct and respect your colleagues"],
      ["Behavioral", "Tell me about a conflict with a teammate and how it was resolved.", "You understood their side first and the work got better.", "Be direct and respect your colleagues"],
      ["Behavioral", "Tell me about a time the requirements were unclear.", "You found out what mattered and started with the smallest useful thing.", "Move fast"],
      ["Experience", "What have you built that you are proud of, and what would you change about it?", "Pride in the craft, and no defensiveness about its faults.", "Build awesome things"],
    ] },
    "Microsoft": { basis: "Built on what Microsoft publishes about its culture: a growth mindset, customer obsession, inclusion, and working as one company.", questions: [
      ["Behavioral", "Tell me about a time you were wrong. What did you learn?", "You treat being wrong as information, not as a threat.", "Growth mindset"],
      ["Behavioral", "Tell me about a time you learned from someone very different from you.", "You went looking for the other view and it changed your work.", "Diverse and inclusive"],
      ["Behavioral", "Tell me about something you delivered that no single team could have done alone.", "You made it easy for other teams to say yes.", "One Microsoft"],
      ["Behavioral", "Tell me about a time you made a customer's problem your own.", "You stayed with it until the customer, not the ticket, was fine.", "Customer obsessed"],
      ["Technical", "Describe a technical decision you made and the trade-offs you weighed.", "You can say what you gave up and why it was worth it.", "Knowledge for the role"],
      ["Motivation", "Why Microsoft, and why this team?", "Something specific about this team's work, tied to what you have done.", "Motivation"],
    ] },
    "Apple": { basis: "Built on what Apple says about how it works: care for detail, people from different crafts working closely, and keeping things simple.", questions: [
      ["Experience", "Tell me about something you made where you cared about a detail nobody asked for.", "The detail mattered to the person using it, and you can say why.", "Care for detail"],
      ["Behavioral", "Tell me about shipping something with people from other disciplines.", "You understood their craft enough to make the handovers disappear.", "Working across crafts"],
      ["Experience", "Tell me about a time you made something complicated simple.", "What you removed, and how you decided it could go.", "Simplicity"],
      ["Situational", "Which of our products would you improve, and how?", "You know the product as a user and argue from what the user needs.", "Product sense"],
      ["Behavioral", "Tell me about a time you could not share what you were working on and still got it done.", "You kept the confidence and found another way to get what you needed.", "Discretion"],
      ["Motivation", "Why Apple, and why this team?", "Something about how Apple builds things, tied to how you like to work.", "Motivation"],
    ] },
    "Netflix": { basis: "Built on Netflix's published culture memo.", questions: [
      ["Behavioral", "Tell me about a time you gave candid feedback to someone senior to you.", "You said the uncomfortable thing plainly, to their face, to help them.", "Candor"],
      ["Behavioral", "Tell me about a decision you made on your own where others would have asked permission.", "You acted in the company's interest and owned how it turned out.", "Freedom and responsibility"],
      ["Behavioral", "Tell me about a time you disagreed openly with a decision. What happened next?", "You said so in the room, then helped make the decision work.", "Candor"],
      ["Experience", "What is the most useful feedback you have been given? What did you do with it?", "You asked for it, and something you do is different because of it.", "Candor"],
      ["Situational", "Tell me about a time there was no rule and you had to use your judgment.", "You reasoned from what the business needed, not from what was safe for you.", "Judgment"],
      ["Behavioral", "Tell me about a time you gave people the background and let them decide.", "You explained the why and trusted them with the how.", "Context, not control"],
    ] },
    "Salesforce": { basis: "Built on Salesforce's published values: trust, customer success, innovation, equality, sustainability.", questions: [
      ["Behavioral", "Tell me about a time you protected a customer's trust when it was inconvenient.", "You chose the customer's trust over the easy path, and said so early.", "Trust"],
      ["Experience", "Tell me about a time you judged your own success by a customer's result.", "The customer's number moved, and you can connect it to your work.", "Customer success"],
      ["Experience", "Tell me about an idea of yours that changed how your team worked.", "You tried it small, showed it worked, and others took it up.", "Innovation"],
      ["Behavioral", "Tell me about a time you made sure a quieter voice was heard.", "You noticed who was not being heard and did something specific.", "Equality"],
      ["Situational", "A customer asks for something the product cannot do. What do you do?", "You find the need behind the request and are honest about what is possible.", "Trust"],
      ["Motivation", "Why Salesforce?", "Something about its customers or its values, tied to your own work.", "Motivation"],
    ] },
    "Airbnb": { basis: "Built on Airbnb's published core values.", questions: [
      ["Motivation", "Why does our mission matter to you?", "A true reason from your own life or work, not a slogan.", "Champion the mission"],
      ["Behavioral", "Tell me about a time you made someone feel they belonged.", "You noticed what the other person needed and acted on it.", "Be a host"],
      ["Behavioral", "Tell me about a time you took on something new with no guide.", "You were curious, you asked, and you learned in the open.", "Embrace the adventure"],
      ["Behavioral", "Tell me about a time you got a lot done with very little.", "You were inventive about the constraint and did not wait for more.", "Be a cereal entrepreneur"],
      ["Experience", "Tell me about a project where you cared about the experience of the person at the other end.", "You can describe that person and what changed for them.", "Be a host"],
      ["Behavioral", "Tell me about a time you were told no and found another way.", "You kept the goal and changed the route.", "Be a cereal entrepreneur"],
    ] },
    "McKinsey & Company": { basis: "Built on McKinsey's Personal Experience Interview, which it describes publicly, and the problem solving it tests beside it.", questions: [
      ["Behavioral", "Tell me about a time you led a group through a difficult situation.", "You brought people with different views along, one conversation at a time.", "Inclusive leadership"],
      ["Behavioral", "Tell me about a time you changed the mind of someone who strongly disagreed with you.", "You understood why they disagreed before you tried to move them.", "Personal impact"],
      ["Behavioral", "Tell me about a goal you set that others thought was too ambitious.", "You kept going through a real setback and can say what it took.", "Entrepreneurial drive"],
      ["Behavioral", "Tell me about a time you had to change course in the face of uncertainty.", "You saw the facts had changed, said so, and adapted quickly.", "Courageous change"],
      ["Situational", "How would you estimate the size of a market you know nothing about? Talk me through it.", "A clear structure, stated assumptions, simple arithmetic, and a sanity check.", "Problem solving"],
      ["Motivation", "Why consulting, and why this firm?", "What you want from the work itself, and one specific thing about this firm.", "Motivation"],
    ] },
    "Capital One": { basis: "Built on Capital One's published values (excellence, do the right thing) and its use of business cases in interviews.", questions: [
      ["Behavioral", "Tell me about a time doing the right thing cost you something.", "You chose it anyway and can say what it cost.", "Do the right thing"],
      ["Situational", "How would you decide whether a new product is worth launching? Talk me through it.", "Revenue, cost, risk and who it is for, in a clear order, with numbers.", "Business case"],
      ["Experience", "Tell me about a time you used data to change a decision.", "The data, the decision before, the decision after, and what happened.", "Excellence"],
      ["Behavioral", "Tell me about a time you raised the standard on your team.", "You showed the better way by doing it, and others followed.", "Excellence"],
      ["Situational", "A number in your analysis looks wrong an hour before the meeting. What do you do?", "You check it, say plainly what you know and do not know, and do not present a guess.", "Do the right thing"],
      ["Motivation", "Why Capital One?", "Something about how it uses data or technology, tied to your own work.", "Motivation"],
    ] },
    "JPMorgan Chase": { basis: "A general set for a large bank: why this firm, how you handle risk and pressure, and integrity. Not taken from anything the firm publishes about its interviews.", questions: [
      ["Motivation", "Why this firm, and why this business?", "You know what this business does and how it differs from its rivals.", "Motivation"],
      ["Situational", "Tell me about something happening in the markets or the economy that interests you.", "A real opinion, the reasoning behind it, and what could prove you wrong.", "Awareness"],
      ["Behavioral", "Tell me about a time you found an error under time pressure.", "You stopped, checked, and told people, although it was uncomfortable.", "Risk and control"],
      ["Behavioral", "Tell me about a time you worked long hours on a team toward a deadline.", "You kept the quality and kept the team together.", "Teamwork"],
      ["Situational", "You are asked to do something that does not feel right. What do you do?", "You ask, you escalate through the proper line, and you do not just go along.", "Integrity"],
      ["Experience", "Tell me about a time you explained something complicated to someone outside your field.", "You started from what they needed to decide, not from what you knew.", "Communication"],
    ] },
    "Comcast": { basis: "A general set for a large network and media company: reliability at scale, the customer's experience, and change without outages. Not taken from anything the company publishes about its interviews.", questions: [
      ["Experience", "Tell me about a system or service you kept running for a very large number of people.", "What could fail, how you would know, and what you did before it did.", "Reliability at scale"],
      ["Behavioral", "Tell me about a time a customer's experience changed what you built or how you worked.", "You heard it from the customer's side and something specific changed.", "Customer experience"],
      ["Situational", "You have to make a change to something millions of people depend on. How do you do it safely?", "Small steps, a way back, a way to see trouble early, and people told in advance.", "Change without outages"],
      ["Behavioral", "Tell me about an outage or a serious incident you were part of.", "A clear order of events, your own part, and what was changed afterwards.", "Reliability at scale"],
      ["Behavioral", "Tell me about getting something done across several large teams.", "You found who decides, made the ask small, and kept everyone informed.", "Working in a large company"],
      ["Motivation", "Why Comcast, and why this team?", "Something specific about this team's work, tied to what you have done.", "Motivation"],
    ] },
  };

  const library = { titles, companies, common, sets };
  window.KOMPAS_LIBRARY = library;
})();
