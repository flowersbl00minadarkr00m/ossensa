import type { EvidenceSourceType } from '../../domain/types';

export type SourceId =
  | 'github'
  | 'gitlab'
  | 'codeberg'
  | 'npm'
  | 'crates'
  | 'packagist'
  | 'wikipedia';

export type SourceKind = 'forge' | 'registry' | 'directory';

export interface DiscoveryLead {
  sourceId: SourceId;
  title: string;
  url: string;
  repoUrl?: string;
  homepage?: string;
  packageName?: string;
  /** OSV ecosystem name when applicable (npm, crates.io, Packagist). */
  ecosystem?: string;
  snippet?: string;
  sourceType: EvidenceSourceType;
  metadata?: {
    stars?: number;
    language?: string;
    licenseSpdx?: string;
    lastActivity?: string;
    archived?: boolean;
    topics?: string[];
    downloads?: number;
  };
}

export interface CandidateIdentity {
  /** Stable id derived from canonical repo or source identity. */
  id: string;
  displayName: string;
  canonicalRepoUrl?: string;
  homepage?: string;
  leads: DiscoveryLead[];
  aliases: string[];
  conflicts: string[];
}

export type SourceStatus =
  | 'ok'
  | 'empty'
  | 'rate-limited'
  | 'failed'
  | 'timeout'
  | 'skipped'
  | 'unavailable';

export interface SourceCoverage {
  sourceId: SourceId;
  label: string;
  kind: SourceKind;
  status: SourceStatus;
  leadCount: number;
  detail?: string;
  retryable: boolean;
}

export interface DiscoveryBudget {
  /** Max total HTTP requests per search. */
  requests: number;
  /** Max evidence pages fetched via proxy per search. */
  pages: number;
  /** Global wall-clock deadline in ms. */
  ms: number;
  /** Max evidence pages per candidate. */
  pagesPerCandidate: number;
}

export const DEFAULT_BUDGET: DiscoveryBudget = {
  requests: 40,
  pages: 12,
  ms: 25_000,
  pagesPerCandidate: 6,
};

export interface BudgetSpend {
  requests: number;
  pages: number;
  ms: number;
}

export interface SearchCoverage {
  sources: SourceCoverage[];
  startedAt: string;
  finishedAt: string;
  budget: DiscoveryBudget;
  spent: BudgetSpend;
  /** Material crawl gaps, plain language. */
  gaps: string[];
  /** Leads that could not be verified to a repo/registry identity. */
  unverifiedLeadCount: number;
}

export type DiscoveryPhase =
  | 'expanding'
  | 'discovering'
  | 'resolving'
  | 'evidence'
  | 'ranking'
  | 'done';

export interface DiscoveryProgress {
  phase: DiscoveryPhase;
  sources: SourceCoverage[];
}

export interface SourceAdapter {
  id: SourceId;
  label: string;
  kind: SourceKind;
  search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]>;
}

/** Typed adapter failure so the orchestrator can classify coverage. */
export class AdapterError extends Error {
  readonly kind: 'rate-limited' | 'failed' | 'timeout';
  constructor(kind: 'rate-limited' | 'failed' | 'timeout', message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AdapterError';
  }
}
