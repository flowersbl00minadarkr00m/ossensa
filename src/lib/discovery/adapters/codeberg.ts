import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

interface GiteaRepo {
  id: number;
  full_name: string;
  description: string;
  html_url: string;
  website: string;
  stars_count: number;
  updated_at: string;
  archived: boolean;
}

export const codebergAdapter: SourceAdapter = {
  id: 'codeberg',
  label: 'Codeberg',
  kind: 'forge',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(query)}&limit=${LEADS_PER_SOURCE}&sort=stars&order=desc`;
    const data = await fetchJson<{ data?: GiteaRepo[] }>(url, signal);
    return (data.data ?? [])
      .filter((repo) => !repo.archived)
      .map((repo) => ({
        sourceId: 'codeberg' as const,
        title: repo.full_name,
        url: repo.html_url,
        repoUrl: repo.html_url,
        homepage: repo.website || undefined,
        snippet: repo.description || undefined,
        sourceType: 'structured-metadata' as const,
        metadata: {
          stars: repo.stars_count,
          lastActivity: repo.updated_at,
        },
      }));
  },
};
