export interface Job {
  id: string;
  title: string;
  company: string;
  company_logo?: string;
  location: string;
  work_model?: 'remote' | 'hybrid' | 'onsite';
  work_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  description: string;
  requirements?: string[];
  skills?: string[];
  experience_years?: number;
  education_level?: string;
  posted_at: string;
  expires_at?: string;
  apply_url: string;
  source?: string;
  h1b_sponsor?: boolean;
  h1b_score?: number;
  is_urgent?: boolean;
}

export interface MatchScore {
  overall: number;
  tier: 'strong' | 'good' | 'fair' | 'poor';
  skills: number;
  experience: number;
  education: number;
  location: number;
  matchedSkills: string[];
  missingSkills: string[];
  aliasesUsed: { canonical: string; alias: string }[];
}

export interface UserJobState {
  saved: boolean;
  applied: boolean;
  notInterested: boolean;
  applicationStatus?: ApplicationStatus;
  appliedAt?: string;
  notes?: string;
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface JobFeedItem extends Job {
  matchScore?: MatchScore;
  userState?: UserJobState;
  h1bData?: { score: number; label: string; color: string };
}

export interface JobFilters {
  location?: string;
  role?: string;
  level?: string;
  workType?: string;
  workModel?: string;
  datePosted?: string;
  yearsExp?: string;
  h1b?: string;
}
