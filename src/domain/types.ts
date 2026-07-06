export interface Constraint {
  id: string;
  text: string;
  category: 'required' | 'preferred' | 'not-acceptable';
  createdAt: string;
}

export interface SearchQuery {
  id: string;
  naturalLanguage: string;
  constraints: Constraint[];
  submittedAt: string;
  source: 'manual' | 'flowsensa-import';
}

/** Where a claim came from. Legacy items without the field are structured metadata. */
export type EvidenceSourceType =
  | 'retrieved-content'
  | 'structured-metadata'
  | 'search-snippet'
  | 'ai-interpretation';

export interface EvidenceItem {
  claim: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: 'high' | 'medium' | 'low';
  sourceType?: EvidenceSourceType;
  /** 'user' marks a correction recorded by the person using OSSensa. */
  origin?: 'system' | 'user';
}

export interface ConstraintCoverage {
  required: { met: Constraint[]; missed: Constraint[] };
  preferred: { met: Constraint[]; missed: Constraint[] };
  disqualified: boolean;
  disqualifyingConstraints: Constraint[];
}

export type LicenseClassification = 'osi-open-source' | 'source-available' | 'proprietary' | 'unknown';

export interface Candidate {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  projectUrl?: string;
  license: string;
  licenseClassification?: LicenseClassification;
  lastRelease: string;
  stars: number;
  language: string;
  deploymentModes: ('hosted' | 'self-hosted' | 'hybrid')[];
  evidence: EvidenceItem[];
  constraintCoverage: ConstraintCoverage;
  /** Other names/identities this candidate was discovered under. */
  aliases?: string[];
  /** Unresolved identity or licence conflicts, shown — never silently resolved. */
  conflicts?: string[];
  /** Discovery sources that contributed to this candidate. */
  sources?: string[];
  /** Dismissed by the user; hidden from ranking but restorable. */
  dismissed?: boolean;
}

export interface CandidateComparison {
  candidateId: string;
  fitVerdict: 'strong' | 'partial' | 'uncertain' | 'poor';
  laymanSummary: string;
  setupEffort: { level: 'low' | 'medium' | 'high'; explanation: string };
  ongoingResponsibility: string;
  evidenceFreshness: string;
  unknowns: string[];
  advantages: string[];
  disadvantages: string[];
  aiAugmented: boolean;
}

export interface Decision {
  id: string;
  candidateId: string;
  queryId: string;
  action: 'accepted' | 'shortlisted' | 'rejected' | 'revisit';
  rationale: string;
  decidedAt: string;
  evidenceSnapshot: EvidenceItem[];
}

export interface SearchHistory {
  id: string;
  query: SearchQuery;
  candidates: Candidate[];
  comparisons: CandidateComparison[];
  decisions: Decision[];
  searchedAt: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export type ActiveView = 'search' | 'results' | 'history' | 'settings';
