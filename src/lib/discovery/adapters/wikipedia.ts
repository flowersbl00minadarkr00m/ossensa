import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson } from './shared';

/**
 * Wikipedia is a directory-type discovery source: its leads are
 * search snippets that must resolve to a repo or registry identity
 * before they can appear as candidates (design FAQ).
 */
export const wikipediaAdapter: SourceAdapter = {
  id: 'wikipedia',
  label: 'Wikipedia',
  kind: 'directory',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(`${query} software`)}&limit=5&format=json&origin=*`;
    const data = await fetchJson<[string, string[], string[], string[]]>(url, signal);
    const [, titles = [], descriptions = [], urls = []] = data;
    return titles.map((title, i) => ({
      sourceId: 'wikipedia' as const,
      title,
      url: urls[i] ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      snippet: descriptions[i] || undefined,
      sourceType: 'search-snippet' as const,
    }));
  },
};
