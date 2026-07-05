import type { EvidenceItem } from '../domain/types';

const BASE = 'https://api.github.com';

/** Returns subset of Candidate fields from GitHub repo metadata. */
export async function fetchRepo(owner: string, repo: string): Promise<{
  stars: number;
  language: string;
  license: string;
  lastRelease: string;
  description: string;
  projectUrl: string | undefined;
}> {
  const [repoRes, releaseRes] = await Promise.all([
    fetch(`${BASE}/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
    }),
    fetch(`${BASE}/repos/${owner}/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    }),
  ]);

  if (!repoRes.ok) throw new Error(`GitHub API: ${repoRes.status} for ${owner}/${repo}`);
  const repoData = await repoRes.json();

  let lastRelease = repoData.pushed_at ?? new Date().toISOString();
  if (releaseRes.ok) {
    const releaseData = await releaseRes.json();
    lastRelease = releaseData.published_at ?? lastRelease;
  }

  return {
    stars: repoData.stargazers_count ?? 0,
    language: repoData.language ?? 'Unknown',
    license: repoData.license?.spdx_id ?? 'Unknown',
    lastRelease,
    description: repoData.description ?? '',
    projectUrl: repoData.homepage ?? undefined,
  };
}

/** Returns an EvidenceItem summarising contributor activity. */
export async function fetchContributorActivity(
  owner: string,
  repo: string,
): Promise<EvidenceItem> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contributors?per_page=5`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  const count = res.ok ? (await res.json()).length : 0;

  return {
    claim: `${count} active contributor${count !== 1 ? 's' : ''} (top 5 shown)`,
    source: 'GitHub API',
    sourceUrl: `https://github.com/${owner}/${repo}/graphs/contributors`,
    retrievedAt: new Date().toISOString(),
    confidence: res.ok ? 'high' : 'low',
  };
}
