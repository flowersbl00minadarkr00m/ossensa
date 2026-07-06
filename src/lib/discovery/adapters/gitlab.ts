import type { DiscoveryLead, SourceAdapter } from '../types';
import { fetchJson, LEADS_PER_SOURCE } from './shared';

interface GitLabProject {
  id: number;
  path_with_namespace: string;
  description: string | null;
  web_url: string;
  star_count: number;
  last_activity_at: string;
  topics?: string[];
}

export const gitlabAdapter: SourceAdapter = {
  id: 'gitlab',
  label: 'GitLab',
  kind: 'forge',
  async search(query: string, signal: AbortSignal): Promise<DiscoveryLead[]> {
    const url = `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&order_by=star_count&sort=desc&per_page=${LEADS_PER_SOURCE}&visibility=public`;
    const data = await fetchJson<GitLabProject[]>(url, signal);
    return data.map((project) => ({
      sourceId: 'gitlab' as const,
      title: project.path_with_namespace,
      url: project.web_url,
      repoUrl: project.web_url,
      snippet: project.description ?? undefined,
      sourceType: 'structured-metadata' as const,
      metadata: {
        stars: project.star_count,
        lastActivity: project.last_activity_at,
        topics: project.topics,
      },
    }));
  },
};
