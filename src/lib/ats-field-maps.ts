// Per-ATS field maps for client-side autofill.
// Recovered via REA from open-source Autofill-Jobs (MIT) — see docs/research/simplify-autofill-recon.md
// Maps HTML field identifiers → canonical profile keys.
// Usage: detect ATS from URL → look up field → find input by id/name/placeholder/aria-*/data-qa → inject via setNativeValue.

export type AtsPlatform = 'greenhouse' | 'lever' | 'workday' | 'dover';

export const ATS_FIELD_MAPS: Record<string, Record<string, string | Record<string, string>>> = {
  "greenhouse": {
    "first_name": "First Name",
    "last_name": "Last Name",
    "Preferred Name": "Full Name",
    "email": "Email",
    "phone": "Phone",
    "LinkedIn": "LinkedIn",
    "Github": "Github",
    "Twitter": "Twitter/X",
    "X": "Twitter/X",
    "candidate-location": "Location (City)",
    "Website": "Website",
    "Portfolio": "Website",
    "Employer": "Current Employer",
    "Current Company": "Current Employer",
    "resume": "Resume",
    "school": "School",
    "degree": "Degree",
    "discipline": "Discipline",
    "start-month": "Start Date Month",
    "start-year": "Start Date Year",
    "end-month": "End Date Month",
    "end-year": "End Date Year",
    "gender": "Gender",
    "hispanic_ethnicity": "Hispanic/Latino",
    "race": "Race",
    "react-select-race-placeholder race-error": "Race",
    "veteran_status": "Veteran Status",
    "disability": "Disability Status"
  },
  "lever": {
    "resume": "Resume",
    "name": "Full Name",
    "email": "Email",
    "phone": "Phone",
    "location": "Location (City)",
    "org": "Current Employer",
    "company": "Current Employer",
    "employer": "Current Employer",
    "urls[LinkedIn]": "LinkedIn",
    "urls[GitHub]": "Github",
    "urls[Linkedin]": "LinkedIn",
    "urls[X]": "Twitter/X",
    "urls[Twitter]": "Twitter/X",
    "urls[Portfolio]": "Website",
    "urls[Link to portfolio]": "Website",
    "website": "Website",
    "portfolio": "Website",
    "eeo[gender]": "Gender",
    "eeo[race]": "Race",
    "eeo[veteran]": "Veteran Status",
    "eeo[disability]": "Disability Status",
    "eeo[disabilitySignature]": "Full Name",
    "eeo[disabilitySignatureDate]": "Current Date"
  },
  "dover": {
    "firstName": "First Name",
    "lastName": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "linkedinUrl": "LinkedIn",
    "github": "Github",
    "phoneNumber": "Phone",
    "resume": "Resume"
  },
  "workday": {
    "My Information": {
      "country": "Location (Country)",
      "firstName": "First Name",
      "lastName": "Last Name",
      "addressLine1": "Location (Street)",
      "addressSection_countryRegion": "Location (State/Region)",
      "city": "Location (City)",
      "postal": "Postal/Zip Code",
      "phone-device-type": "Phone Type",
      "phoneType": "Phone Type",
      "phone-number": "Phone",
      "phoneNumber": "Phone"
    },
    "My Experience": {
      "add-button": "Work Experience",
      "schoolName": "School",
      "degree": "Degree",
      "fieldOfStudy": "Discipline",
      "gradeAverage": "GPA",
      "selectedItemList": "Skills",
      "file-upload-input-ref": "Resume",
      "linkedin": "LinkedIn"
    },
    "Voluntary Disclosures": {
      "ethnicity": "Race",
      "race": "Race",
      "gender": "Gender",
      "veteran": "Veteran Status",
      "disability": "Disability Status"
    },
    "Self Identify": {
      "name": "Full Name",
      "month-input": "Current Date",
      "day-input": "Current Date",
      "year-input": "Current Date"
    }
  }
};

// URL patterns to detect the ATS platform from a job/apply URL.
export const ATS_URL_PATTERNS: Record<AtsPlatform, RegExp[]> = {
  greenhouse: [/boards.greenhouse.io/i, /greenhouse.io/i],
  lever: [/lever.co/i],
  workday: [/myworkdayjobs.com/i, /workday/i],
  dover: [/dover.io/i, /app.dover/i],
};

export function detectAts(url: string): AtsPlatform | null {
  for (const [platform, patterns] of Object.entries(ATS_URL_PATTERNS)) {
    if (patterns.some(p => p.test(url))) return platform as AtsPlatform;
  }
  return null;
}
