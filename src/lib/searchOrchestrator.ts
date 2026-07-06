import type { Candidate, SearchQuery } from '../domain/types';
import { rankCandidates, applyResultCap } from '../domain/search';
import { SYNTHETIC_CANDIDATES } from '../fixtures/synthetic-candidates';
import { attachCoverage } from './discovery/constraintCoverage';
import {
  runWebDiscovery,
  retrySource,
  type DiscoveryOptions,
  type DiscoveryResult,
} from './discovery/orchestrator';

export type { DiscoveryResult } from './discovery/orchestrator';
export { retrySource };

/**
 * Demo mode orchestrator — uses synthetic candidates, no network calls.
 * Only ever runs when the user explicitly enables demo mode (US-001).
 */
export async function runDemoSearch(query: SearchQuery): Promise<Candidate[]> {
  const candidates = SYNTHETIC_CANDIDATES.map((raw) =>
    attachCoverage(raw, query.constraints),
  );
  const ranked = rankCandidates(candidates, query.constraints);
  return applyResultCap(ranked);
}

/**
 * Live orchestrator — web-wide discovery across forges, registries, and
 * directory sources (002-web-discovery). Returns verified candidates plus a
 * source-coverage report; never silently substitutes demo data.
 */
export async function runLiveSearch(
  query: SearchQuery,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  return runWebDiscovery(query, options);
}
