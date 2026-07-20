import type {
  BudgetSpend,
  DiscoveryBudget,
  SearchCoverage,
  SourceCoverage,
} from './types';

/** Plain-language gap notes for the coverage report (FR-008, US-003). */
export function describeGaps(
  sources: SourceCoverage[],
  proxyAvailable: boolean,
  deadlineHit: boolean,
  unverifiedLeadCount: number,
  curatedFiltered = 0,
): string[] {
  const gaps: string[] = [];

  for (const source of sources) {
    if (source.status === 'rate-limited') {
      gaps.push(`${source.label} is rate-limited — its projects may be missing from this result. ${source.detail ?? ''}`.trim());
    } else if (source.status === 'failed' || source.status === 'timeout') {
      gaps.push(`${source.label} could not be searched (${source.detail ?? source.status}) — coverage from that source is missing.`);
    }
  }

  if (!proxyAvailable) {
    gaps.push('Official-site evidence retrieval is unavailable in this deployment — licence and identity checks rely on forge and registry metadata only.');
  }
  if (deadlineHit) {
    gaps.push('The search hit its time budget — results are verified partials, not a complete sweep.');
  }
  if (unverifiedLeadCount > 0) {
    gaps.push(`${unverifiedLeadCount} discovery lead${unverifiedLeadCount === 1 ? '' : 's'} could not be verified against a repository or registry identity and ${unverifiedLeadCount === 1 ? 'is' : 'are'} not shown as candidates.`);
  }
  if (curatedFiltered > 0) {
    gaps.push(`${curatedFiltered} curated list${curatedFiltered === 1 ? '' : 's'} (e.g. "awesome-*" collections) ${curatedFiltered === 1 ? 'was' : 'were'} filtered out — they are catalogues, not installable software.`);
  }

  return gaps;
}

export function buildCoverage(args: {
  sources: SourceCoverage[];
  startedAt: string;
  budget: DiscoveryBudget;
  spent: BudgetSpend;
  proxyAvailable: boolean;
  deadlineHit: boolean;
  unverifiedLeadCount: number;
  curatedFiltered?: number;
  feedbackQueries?: string[];
}): SearchCoverage {
  const feedbackQueries = args.feedbackQueries ?? [];
  const gaps = describeGaps(
    args.sources,
    args.proxyAvailable,
    args.deadlineHit,
    args.unverifiedLeadCount,
    args.curatedFiltered ?? 0,
  );
  if (feedbackQueries.length > 0) {
    gaps.push(
      `Broadened the search with ${feedbackQueries.length} follow-up quer${feedbackQueries.length === 1 ? 'y' : 'ies'} from candidate topics: ${feedbackQueries.join(', ')}.`,
    );
  }
  return {
    sources: args.sources,
    startedAt: args.startedAt,
    finishedAt: new Date().toISOString(),
    budget: args.budget,
    spent: args.spent,
    gaps,
    unverifiedLeadCount: args.unverifiedLeadCount,
    feedbackQueries: feedbackQueries.length > 0 ? feedbackQueries : undefined,
  };
}
