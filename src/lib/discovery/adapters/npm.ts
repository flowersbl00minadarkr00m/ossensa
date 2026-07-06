import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

interface NpmSearchObject {
  package: {
    name: string;
    description?: string;
    date?: string;
    license?: string;
    links?: { npm?: string; homepage?: string; repository?: string };
  };
  score?: { final?: number };
}

export const npmAdapter: SourceAdapter = {
  id: 'npm',
  label: 'npm registry',
  kind: 'registry',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${LEADS_PER_SOURCE}`;
    const data = await fetchJson<{ objects?: NpmSearchObject[] }>(url, signal);
    return (data.objects ?? []).map(({ package: pkg }) => ({
      sourceId: 'npm' as const,
      title: pkg.name,
      url: pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`,
      repoUrl: pkg.links?.repository,
      homepage: pkg.links?.homepage,
      packageName: pkg.name,
      ecosystem: 'npm',
      snippet: pkg.description,
      sourceType: 'structured-metadata' as const,
      metadata: {
        licenseSpdx: pkg.license,
        lastActivity: pkg.date,
      },
    }));
  },
};
