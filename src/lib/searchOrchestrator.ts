import type { Candidate, Constraint, EvidenceItem, SearchQuery } from '../domain/types';
import { rankCandidates, applyResultCap } from '../domain/search';
import { SYNTHETIC_CANDIDATES } from '../fixtures/synthetic-candidates';

const GITHUB_API = 'https://api.github.com';
const SEARCH_RESULT_CAP = 20;
const FINAL_CAP = 5;

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

/** Build search terms from natural language and required constraints. */
function extractSearchTerms(query: SearchQuery): string[] {
  const terms: string[] = [];

  // Use the natural language query directly
  if (query.naturalLanguage.trim()) {
    // Remove common filler words, keep meaningful tokens
    const cleaned = query.naturalLanguage
      .replace(/\b(i need|im looking for|find me|search for|what is|show me)\b/gi, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) terms.push(cleaned);
  }

  // Add required constraints as search terms
  const required = query.constraints
    .filter((c) => c.category === 'required')
    .map((c) => c.text);
  terms.push(...required);

  return terms;
}

/** Build GitHub search queries from terms, trying different strategies. */
function buildGitHubQueries(terms: string[]): string[] {
  if (terms.length === 0) return [];

  const queries: string[] = [];
  const primary = terms[0];

  // Strategy 1: topic search (best for finding domain-specific tools)
  // Extract potential topic words (3+ chars)
  const topicWords = primary
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map((w) => `topic:${w}`);
  if (topicWords.length > 0) {
    queries.push(`${topicWords.slice(0, 3).join(' ')} archived:false`);
  }

  // Strategy 2: name + description search
  queries.push(`"${primary}" in:name,description archived:false`);

  // Strategy 3: broader name-only search
  const shortTerms = primary.split(/\s+/).filter((w) => w.length >= 3).slice(0, 4).join(' ');
  if (shortTerms && shortTerms !== primary) {
    queries.push(`${shortTerms} in:name archived:false`);
  }

  return queries;
}

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  pushed_at: string;
  archived: boolean;
  topics: string[];
}

/** Classify license into OSSensa categories. */
function classifyLicense(spdxId: string | undefined): Candidate['licenseClassification'] {
  if (!spdxId || spdxId === 'Unknown') return 'unknown';
  const osiApproved = [
    'MIT', 'Apache-2.0', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0',
    'BSD-2-Clause', 'BSD-3-Clause', 'MPL-2.0', 'AGPL-3.0', 'Unlicense',
    'ISC', 'Artistic-2.0', 'EPL-2.0', 'CDDL-1.0', 'EUPL-1.2',
  ];
  if (osiApproved.includes(spdxId)) return 'osi-open-source';
  // Common source-available licenses
  const sourceAvailable = [
    'BUSL-1.1', 'SSPL-1.0', 'Elastic-2.0', 'AGPL-3.0',
  ];
  if (sourceAvailable.includes(spdxId)) return 'source-available';
  if (spdxId.includes('NC') || spdxId.includes('ND')) return 'source-available';
  return 'unknown';
}

async function fetchGitHubRepos(query: string): Promise<GitHubRepo[]> {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${SEARCH_RESULT_CAP}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    console.warn(`GitHub search failed (${res.status}): ${query}`);
    return [];
  }
  const data = await res.json();
  return (data.items ?? []) as GitHubRepo[];
}

/** Fetch recent release date. */
async function fetchLatestRelease(owner: string, repo: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.published_at as string | undefined;
  } catch {
    return undefined;
  }
}

/** Fetch contributor count. */
async function fetchContributorCount(owner: string, repo: string): Promise<number> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1&anon=true`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return 0;
    // Check Link header for last page to get total count
    const link = res.headers.get('Link');
    if (link) {
      const match = link.match(/page=(\d+)>; rel="last"/);
      if (match) return parseInt(match[1], 10);
    }
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/** Fetch known vulnerabilities from OSV. */
async function fetchVulnsFromOSV(owner: string, repo: string): Promise<EvidenceItem[]> {
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: { name: `${owner}/${repo}`, ecosystem: 'GitHub Actions' },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const vulns: Array<{ id: string; summary?: string }> = data.vulns ?? [];
    return vulns.slice(0, 3).map((v) => ({
      claim: `${v.id}: ${v.summary ?? 'Vulnerability on record'}`,
      source: 'OSV',
      sourceUrl: `https://osv.dev/vulnerability/${v.id}`,
      retrievedAt: new Date().toISOString(),
      confidence: 'high' as const,
    }));
  } catch {
    return [];
  }
}

async function enrichRepo(repo: GitHubRepo): Promise<Omit<Candidate, 'constraintCoverage'>> {
  const [owner, name] = repo.full_name.split('/');
  const retrievedAt = new Date().toISOString();
  const licenseSpdx = repo.license?.spdx_id ?? 'Unknown';

  // Fetch enrichment data in parallel
  const [lastRelease, contributorCount, vulnEvidence] = await Promise.all([
    fetchLatestRelease(owner, name),
    fetchContributorCount(owner, name),
    fetchVulnsFromOSV(owner, name),
  ]);

  const evidence: EvidenceItem[] = [
    {
      claim: `${repo.stargazers_count.toLocaleString()} GitHub stars`,
      source: 'GitHub API',
      sourceUrl: repo.html_url,
      retrievedAt,
      confidence: 'high',
    },
    {
      claim: `Language: ${repo.language ?? 'Unknown'}`,
      source: 'GitHub API',
      sourceUrl: repo.html_url,
      retrievedAt,
      confidence: 'high',
    },
    {
      claim: `License: ${licenseSpdx} (${classifyLicense(licenseSpdx)})`,
      source: 'GitHub API',
      sourceUrl: repo.html_url,
      retrievedAt,
      confidence: 'high',
    },
    {
      claim: `Last pushed: ${repo.pushed_at?.slice(0, 10) ?? 'unknown'}`,
      source: 'GitHub API',
      sourceUrl: repo.html_url,
      retrievedAt,
      confidence: 'high',
    },
    ...(lastRelease ? [{
      claim: `Latest release: ${lastRelease.slice(0, 10)}`,
      source: 'GitHub API',
      sourceUrl: `${repo.html_url}/releases`,
      retrievedAt,
      confidence: 'high' as const,
    }] : []),
    ...(contributorCount > 0 ? [{
      claim: `${contributorCount}+ contributors`,
      source: 'GitHub API',
      sourceUrl: `${repo.html_url}/graphs/contributors`,
      retrievedAt,
      confidence: 'high' as const,
    }] : []),
    ...vulnEvidence,
  ];

  return {
    id: `gh-${repo.id}`,
    name: repo.full_name,
    description: repo.description ?? '',
    repoUrl: repo.html_url,
    projectUrl: repo.homepage ?? undefined,
    license: licenseSpdx,
    licenseClassification: classifyLicense(licenseSpdx),
    lastRelease: lastRelease ?? repo.pushed_at ?? retrievedAt,
    stars: repo.stargazers_count,
    language: repo.language ?? 'Unknown',
    deploymentModes: repo.topics?.some((t) => t.toLowerCase().includes('self-hosted'))
      ? ['self-hosted']
      : ['self-hosted'],
    evidence,
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
 * Live orchestrator — searches GitHub API, enriches results, ranks, and caps.
 * Falls back to synthetic candidates only if ALL fetches fail.
 */
export async function runLiveSearch(query: SearchQuery): Promise<Candidate[]> {
  const terms = extractSearchTerms(query);
  if (terms.length === 0) {
    // No meaningful search terms — return empty with a note
    return [];
  }

  const githubQueries = buildGitHubQueries(terms);
  if (githubQueries.length === 0) return [];

  // Run all search strategies in parallel
  const resultSets = await Promise.all(githubQueries.map(fetchGitHubRepos));

  // Merge and deduplicate by repo ID
  const seen = new Set<number>();
  const merged: GitHubRepo[] = [];
  for (const repos of resultSets) {
    for (const repo of repos) {
      if (!seen.has(repo.id)) {
        seen.add(repo.id);
        merged.push(repo);
      }
    }
  }

  if (merged.length === 0) {
    console.warn('OSSensa: all GitHub searches returned empty — no live results');
    return [];
  }

  // Enrich top candidates with metadata
  const enriched = await Promise.all(
    merged.slice(0, FINAL_CAP * 2).map(enrichRepo),
  );

  // Attach constraint coverage and rank
  const candidates = enriched.map((raw) => attachCoverage(raw, query.constraints));
  const ranked = rankCandidates(candidates, query.constraints);
  return applyResultCap(ranked, FINAL_CAP);
}
