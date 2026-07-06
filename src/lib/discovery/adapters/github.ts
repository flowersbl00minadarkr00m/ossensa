import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

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

export const githubAdapter: SourceAdapter = {
  id: 'github',
  label: 'GitHub',
  kind: 'forge',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    // Best-match (relevance) sort surfaces the canonical tool for a topic;
    // star-sort buries it under bigger repos that merely mention the term.
    // Adoption re-ranking happens downstream in relevance scoring.
    const q = `${query} in:name,description,readme archived:false`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${LEADS_PER_SOURCE}`;
    const data = await fetchJson<{ items?: GitHubRepo[] }>(url, signal, {
      Accept: 'application/vnd.github+json',
    });
    return (data.items ?? []).map((repo) => ({
      sourceId: 'github' as const,
      title: repo.full_name,
      url: repo.html_url,
      repoUrl: repo.html_url,
      homepage: repo.homepage || undefined,
      snippet: repo.description ?? undefined,
      sourceType: 'structured-metadata' as const,
      metadata: {
        stars: repo.stargazers_count,
        language: repo.language ?? undefined,
        licenseSpdx: repo.license?.spdx_id,
        lastActivity: repo.pushed_at,
        archived: repo.archived,
        topics: repo.topics,
      },
    }));
  },
};
