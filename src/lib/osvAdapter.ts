import type { EvidenceItem } from '../domain/types';

/** Query OSV.dev for known vulnerabilities for a package. */
export async function fetchVulns(
  ecosystem: string,
  packageName: string,
): Promise<EvidenceItem[]> {
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name: packageName, ecosystem } }),
    });

    if (!res.ok) {
      return [
        {
          claim: 'OSV vulnerability query failed',
          source: 'OSV',
          sourceUrl: 'https://osv.dev',
          retrievedAt: new Date().toISOString(),
          confidence: 'low',
        },
      ];
    }

    const data = await res.json();
    const vulns: Array<{ id: string; summary?: string }> = data.vulns ?? [];

    if (vulns.length === 0) {
      return [
        {
          claim: 'No known vulnerabilities found in OSV database',
          source: 'OSV',
          sourceUrl: `https://osv.dev/list?ecosystem=${ecosystem}&q=${packageName}`,
          retrievedAt: new Date().toISOString(),
          confidence: 'high',
        },
      ];
    }

    return vulns.slice(0, 3).map((v) => ({
      claim: `${v.id}: ${v.summary ?? 'Vulnerability on record'}`,
      source: 'OSV',
      sourceUrl: `https://osv.dev/vulnerability/${v.id}`,
      retrievedAt: new Date().toISOString(),
      confidence: 'high',
    }));
  } catch {
    return [];
  }
}
