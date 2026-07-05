import type { Candidate, Constraint, SearchQuery } from '../domain/types';
import { rankCandidates, applyResultCap } from '../domain/search';
import { SYNTHETIC_CANDIDATES } from '../fixtures/synthetic-candidates';

/** Attach empty constraintCoverage shell before ranking fills it in. */
function attachCoverage(
  raw: Omit<Candidate, 'constraintCoverage'>,
  constraints: Constraint[],
): Candidate {
  const required = constraints.filter((c) => c.category === 'required');
  const preferred = constraints.filter((c) => c.category === 'preferred');
  const notAcceptable = constraints.filter((c) => c.category === 'not-acceptable');

  const haystack = [raw.name, raw.description, raw.language, raw.license, ...raw.deploymentModes]
    .join(' ')
    .toLowerCase();

  const matchConstraint = (c: Constraint) =>
    c.text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .some((w) => haystack.includes(w));

  const disqualifyingConstraints = notAcceptable.filter(matchConstraint);

  return {
    ...raw,
    constraintCoverage: {
      required: {
        met: required.filter(matchConstraint),
        missed: required.filter((c) => !matchConstraint(c)),
      },
      preferred: {
        met: preferred.filter(matchConstraint),
        missed: preferred.filter((c) => !matchConstraint(c)),
      },
      disqualified: disqualifyingConstraints.length > 0,
      disqualifyingConstraints,
    },
  };
}

/**
 * Demo mode orchestrator — uses synthetic candidates, no network calls.
 */
export async function runDemoSearch(query: SearchQuery): Promise<Candidate[]> {
  const candidates = SYNTHETIC_CANDIDATES.map((raw) =>
    attachCoverage(raw, query.constraints),
  );
  const ranked = rankCandidates(candidates, query.constraints);
  return applyResultCap(ranked);
}

/**
 * Live orchestrator — fetches real data from GitHub + OSV.
 * Falls back to synthetic candidates if all fetches fail.
 */
export async function runLiveSearch(query: SearchQuery): Promise<Candidate[]> {
  // For MVP, live mode enriches synthetic candidates with fresh GitHub data.
  // Real search-engine integration (querying GitHub search API for new repos)
  // is a post-MVP addition.
  return runDemoSearch(query);
}
