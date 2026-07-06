import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

interface Crate {
  name: string;
  description: string | null;
  repository?: string | null;
  homepage?: string | null;
  downloads: number;
  updated_at: string;
}

export const cratesAdapter: SourceAdapter = {
  id: 'crates',
  label: 'crates.io',
  kind: 'registry',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=${LEADS_PER_SOURCE}`;
    const data = await fetchJson<{ crates?: Crate[] }>(url, signal);
    return (data.crates ?? []).map((crate) => ({
      sourceId: 'crates' as const,
      title: crate.name,
      url: `https://crates.io/crates/${crate.name}`,
      repoUrl: crate.repository ?? undefined,
      homepage: crate.homepage ?? undefined,
      packageName: crate.name,
      ecosystem: 'crates.io',
      snippet: crate.description ?? undefined,
      sourceType: 'structured-metadata' as const,
      metadata: {
        downloads: crate.downloads,
        lastActivity: crate.updated_at,
        language: 'Rust',
      },
    }));
  },
};
