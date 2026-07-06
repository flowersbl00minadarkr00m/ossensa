import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

interface PackagistResult {
  name: string;
  description: string;
  url: string;
  repository: string;
  downloads: number;
  favers: number;
}

export const packagistAdapter: SourceAdapter = {
  id: 'packagist',
  label: 'Packagist',
  kind: 'registry',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=${LEADS_PER_SOURCE}`;
    const data = await fetchJson<{ results?: PackagistResult[] }>(url, signal);
    return (data.results ?? []).map((pkg) => ({
      sourceId: 'packagist' as const,
      title: pkg.name,
      url: pkg.url,
      repoUrl: pkg.repository || undefined,
      packageName: pkg.name,
      ecosystem: 'Packagist',
      snippet: pkg.description || undefined,
      sourceType: 'structured-metadata' as const,
      metadata: {
        downloads: pkg.downloads,
        stars: pkg.favers,
        language: 'PHP',
      },
    }));
  },
};
