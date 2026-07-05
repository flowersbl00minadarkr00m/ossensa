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

export interface EvidenceItem {
  claim: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConstraintCoverage {
  required: { met: Constraint[]; missed: Constraint[] };
  preferred: { met: Constraint[]; missed: Constraint[] };
  disqualified: boolean;
  disqualifyingConstraints: Constraint[];
}

export interface Candidate {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  projectUrl?: string;
  license: string;
  lastRelease: string;
  stars: number;
  language: string;
  deploymentModes: ('hosted' | 'self-hosted' | 'hybrid')[];
  evidence: EvidenceItem[];
  constraintCoverage: ConstraintCoverage;
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
