import type { Candidate, SearchQuery } from '../../domain/types';
import { rankCandidates, applyResultCap } from '../../domain/search';
import { githubAdapter } from './adapters/github';
import { gitlabAdapter } from './adapters/gitlab';
import { codebergAdapter } from './adapters/codeberg';
import { npmAdapter } from './adapters/npm';
import { cratesAdapter } from './adapters/crates';
import { packagistAdapter } from './adapters/packagist';
import { wikipediaAdapter } from './adapters/wikipedia';
import { expandQueries } from './expandQueries';
import { resolveIdentities } from './resolveIdentities';
import { buildIntentTerms, isCuratedListLead, scoreRelevance } from './relevance';
import { buildCandidate, probeEvidenceProxy } from './gatherEvidence';
import { buildCoverage } from './coverage';
import { attachCoverage } from './constraintCoverage';
import {
  AdapterError,
  DEFAULT_BUDGET,
  type BudgetSpend,
  type DiscoveryBudget,
  type DiscoveryLead,
  type DiscoveryProgress,
  type SearchCoverage,
  type SourceAdapter,
  type SourceCoverage,
} from './types';

export const ALL_ADAPTERS: SourceAdapter[] = [
  githubAdapter,
  gitlabAdapter,
  codebergAdapter,
  npmAdapter,
  cratesAdapter,
  packagistAdapter,
  wikipediaAdapter,
];

const QUERIES_PER_ADAPTER = 2;
const PER_SOURCE_TIMEOUT_MS = 8_000;
const MAX_CANDIDATES_TO_VERIFY = 8;
const FINAL_CAP = 5;

export interface DiscoveryResult {
  candidates: Candidate[];
  coverage: SearchCoverage;
}

export interface DiscoveryOptions {
  budget?: Partial<DiscoveryBudget>;
  adapters?: SourceAdapter[];
  onProgress?: (progress: DiscoveryProgress) => void;
  /** Override proxy detection (tests). */
  proxyAvailable?: boolean;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function runAdapter(
  adapter: SourceAdapter,
  queries: string[],
  spent: BudgetSpend,
  budget: DiscoveryBudget,
): Promise<{ leads: DiscoveryLead[]; coverage: SourceCoverage }> {
  const leads: DiscoveryLead[] = [];
  let status: SourceCoverage['status'] = 'ok';
  let detail: string | undefined;

  for (const query of queries.slice(0, QUERIES_PER_ADAPTER)) {
    if (spent.requests >= budget.requests) {
      if (leads.length === 0) {
        status = 'skipped';
        detail = 'Request budget exhausted before this source was searched';
      }
      break;
    }
    spent.requests += 1;
    try {
      const batch = await adapter.search(query, timeoutSignal(PER_SOURCE_TIMEOUT_MS));
      leads.push(...batch);
    } catch (err) {
      if (err instanceof AdapterError) {
        status = err.kind === 'rate-limited' ? 'rate-limited' : err.kind === 'timeout' ? 'timeout' : 'failed';
        detail = err.message;
      } else {
        status = 'failed';
        detail = (err as Error).message;
      }
      break; // do not hammer a failing source with more queries
    }
  }

  // Dedupe within source by URL
  const seen = new Set<string>();
  const deduped = leads.filter((lead) => {
    if (seen.has(lead.url)) return false;
    seen.add(lead.url);
    return true;
  });

  if (status === 'ok' && deduped.length === 0) status = 'empty';

  return {
    leads: deduped,
    coverage: {
      sourceId: adapter.id,
      label: adapter.label,
      kind: adapter.kind,
      status,
      leadCount: deduped.length,
      detail,
      retryable: status === 'rate-limited' || status === 'failed' || status === 'timeout' || status === 'skipped',
    },
  };
}

/**
 * Web-wide discovery pipeline (FR-001..FR-008).
 * Sources are isolated: one failure never rejects the batch. Results at the
 * deadline are verified partials with the gap reported — never demo data.
 */
export async function runWebDiscovery(
  query: SearchQuery,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const budget: DiscoveryBudget = { ...DEFAULT_BUDGET, ...options.budget };
  const adapters = options.adapters ?? ALL_ADAPTERS;
  const spent: BudgetSpend = { requests: 0, pages: 0, ms: 0 };
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const deadline = startMs + budget.ms;

  const sourceStates: SourceCoverage[] = adapters.map((adapter) => ({
    sourceId: adapter.id,
    label: adapter.label,
    kind: adapter.kind,
    status: 'skipped',
    leadCount: 0,
    retryable: true,
  }));
  const emit = (phase: DiscoveryProgress['phase']) =>
    options.onProgress?.({ phase, sources: sourceStates.map((s) => ({ ...s })) });

  emit('expanding');
  const { original, queries } = expandQueries(query);
  if (queries.length === 0) {
    return {
      candidates: [],
      coverage: buildCoverage({
        sources: sourceStates,
        startedAt,
        budget,
        spent,
        proxyAvailable: false,
        deadlineHit: false,
        unverifiedLeadCount: 0,
      }),
    };
  }

  const proxyAvailable = options.proxyAvailable ?? (await probeEvidenceProxy());

  emit('discovering');
  const outcomes = await Promise.allSettled(
    adapters.map(async (adapter, i) => {
      const result = await runAdapter(adapter, queries, spent, budget);
      sourceStates[i] = result.coverage;
      emit('discovering');
      return result;
    }),
  );

  // Curated lists (awesome-*, public-apis, roadmaps) match almost any keyword
  // and dominate on stars, but are not runnable software — drop them and
  // count them as a coverage note (FR-007, NFR-004).
  const allLeads: DiscoveryLead[] = [];
  let curatedFiltered = 0;
  for (const outcome of outcomes) {
    if (outcome.status !== 'fulfilled') continue;
    for (const lead of outcome.value.leads) {
      if (isCuratedListLead(lead)) {
        curatedFiltered += 1;
      } else {
        allLeads.push(lead);
      }
    }
  }

  emit('resolving');
  const { identities, unverifiedLeads } = resolveIdentities(allLeads);

  // Order verification by topical relevance to the intent, not raw popularity,
  // so an on-topic project outranks a bigger off-topic repo (benchmark gate).
  const intentTerms = buildIntentTerms(original, queries);
  const byRelevance = identities
    .map((identity) => ({ identity, relevance: scoreRelevance(identity, intentTerms) }))
    .sort((a, b) => b.relevance - a.relevance);
  const relevant = byRelevance.filter((entry) => entry.relevance > 0);
  const pool = (relevant.length > 0 ? relevant : byRelevance).map((entry) => entry.identity);

  emit('evidence');
  const toVerify = pool.slice(0, MAX_CANDIDATES_TO_VERIFY);
  const ctx = { budget, spent, proxyAvailable, deadline };
  const rawCandidates = await Promise.all(
    toVerify.map((identity) => buildCandidate(identity, ctx)),
  );

  emit('ranking');
  const candidates = rawCandidates.map((raw) => attachCoverage(raw, query.constraints));
  const ranked = applyResultCap(rankCandidates(candidates, query.constraints), FINAL_CAP);

  spent.ms = Date.now() - startMs;
  const coverage = buildCoverage({
    sources: sourceStates,
    startedAt,
    budget,
    spent,
    proxyAvailable,
    deadlineHit: Date.now() >= deadline,
    unverifiedLeadCount: unverifiedLeads.length,
    curatedFiltered,
  });

  emit('done');
  return { candidates: ranked, coverage };
}

/**
 * Re-run a single failed source and merge its verified candidates into an
 * existing result (FR-008: failed sources stay retryable without a full rerun).
 */
export async function retrySource(
  query: SearchQuery,
  sourceId: string,
  previous: DiscoveryResult,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const adapter = (options.adapters ?? ALL_ADAPTERS).find((a) => a.id === sourceId);
  if (!adapter) return previous;

  const single = await runWebDiscovery(query, { ...options, adapters: [adapter] });

  const merged = new Map<string, Candidate>();
  for (const candidate of [...previous.candidates, ...single.candidates]) {
    if (!merged.has(candidate.id)) merged.set(candidate.id, candidate);
  }
  const ranked = applyResultCap(rankCandidates([...merged.values()], query.constraints), FINAL_CAP);

  const sources = previous.coverage.sources.map((s) =>
    s.sourceId === sourceId ? single.coverage.sources[0] ?? s : s,
  );

  return {
    candidates: ranked,
    coverage: {
      ...previous.coverage,
      sources,
      finishedAt: new Date().toISOString(),
      gaps: single.coverage.gaps.length > 0 && single.coverage.sources[0]?.status !== 'ok'
        ? previous.coverage.gaps
        : previous.coverage.gaps.filter((gap) => !gap.startsWith(adapter.label)),
    },
  };
}
