export interface AliasUsed {
  canonical: string;
  alias: string;
}

export interface SkillScoreResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  aliasesUsed: AliasUsed[];
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
  aliasesUsed: AliasUsed[];
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
