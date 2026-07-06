import type { Candidate, EvidenceItem } from '../../domain/types';
import { classifyLicense, normalizeLicense } from '../spdxAdapter';
import { fetchVulns } from '../osvAdapter';
import type { BudgetSpend, CandidateIdentity, DiscoveryBudget, DiscoveryLead } from './types';

// ── Evidence proxy (api/fetch) client ────────────────────────────────────────

export interface ProxyPage {
  finalUrl: string;
  title?: string;
  description?: string;
  licenseSpdx?: string;
  truncated: boolean;
  retrievedAt: string;
}

let proxyProbe: Promise<boolean> | null = null;

/** One-time feature detection: is the evidence fetch function deployed? */
export function probeEvidenceProxy(): Promise<boolean> {
  proxyProbe ??= fetch('/api/fetch?probe=1')
    .then((res) => res.ok)
    .catch(() => false);
  return proxyProbe;
}

/** Test hook. */
export function resetProxyProbe(): void {
  proxyProbe = null;
}

export async function fetchPageViaProxy(url: string): Promise<ProxyPage | null> {
  try {
    const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()) as ProxyPage;
  } catch {
    return null;
  }
}

// ── Candidate assembly ───────────────────────────────────────────────────────

/** Strip GitHub emoji shortcodes and collapse whitespace in a description. */
export function cleanDescription(raw: string): string {
  return raw
    .replace(/:[a-z0-9_+-]+:/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestLead(identity: CandidateIdentity): DiscoveryLead {
  // Prefer forge leads (richest metadata), then registries, then snippets
  const priority: Record<string, number> = { forge: 0, registry: 1, directory: 2 };
  const kindOf = (lead: DiscoveryLead) =>
    lead.sourceId === 'github' || lead.sourceId === 'gitlab' || lead.sourceId === 'codeberg'
      ? 'forge'
      : lead.sourceId === 'wikipedia'
        ? 'directory'
        : 'registry';
  return [...identity.leads].sort((a, b) => priority[kindOf(a)] - priority[kindOf(b)])[0];
}

function metadataEvidence(identity: CandidateIdentity, retrievedAt: string): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const lead of identity.leads) {
    const meta = lead.metadata;
    const push = (claim: string, confidence: EvidenceItem['confidence'] = 'high') =>
      items.push({
        claim,
        source: lead.sourceId,
        sourceUrl: lead.url,
        retrievedAt,
        confidence,
        sourceType: lead.sourceType,
      });

    if (meta?.stars !== undefined && meta.stars > 0) push(`${meta.stars.toLocaleString()} stars on ${lead.sourceId}`);
    if (meta?.downloads !== undefined) push(`${meta.downloads.toLocaleString()} downloads via ${lead.sourceId}`);
    if (meta?.licenseSpdx) push(`Licence reported as ${meta.licenseSpdx} by ${lead.sourceId}`);
    if (meta?.lastActivity) push(`Last activity ${meta.lastActivity.slice(0, 10)} (${lead.sourceId})`);
    if (lead.sourceType === 'search-snippet' && lead.snippet) {
      items.push({
        claim: `Described as: "${lead.snippet.slice(0, 140)}" — discovery lead, unverified`,
        source: lead.sourceId,
        sourceUrl: lead.url,
        retrievedAt,
        confidence: 'low',
        sourceType: 'search-snippet',
      });
    }
  }
  return items;
}

/** Resolve the SPDX licence for an identity from structured metadata only. */
function licenseFromMetadata(identity: CandidateIdentity): string | undefined {
  const claims = identity.leads
    .map((lead) => lead.metadata?.licenseSpdx)
    .filter((v): v is string => Boolean(v && v !== 'Unknown'));
  if (claims.length === 0) return undefined;
  const normalized = [...new Set(claims.map((c) => normalizeLicense(c)))];
  // Conflicts are recorded by resolveIdentities; a conflicted licence is unknown
  return normalized.length === 1 ? normalized[0] : undefined;
}

export interface EvidenceContext {
  budget: DiscoveryBudget;
  spent: BudgetSpend;
  proxyAvailable: boolean;
  deadline: number;
  signal?: AbortSignal;
}

/**
 * Turn a resolved identity into an evidence-grounded Candidate (FR-004..FR-006).
 * Structured metadata first; the guarded proxy upgrades licence/site evidence
 * when available and within budget.
 */
export async function buildCandidate(
  identity: CandidateIdentity,
  ctx: EvidenceContext,
): Promise<Omit<Candidate, 'constraintCoverage'>> {
  const retrievedAt = new Date().toISOString();
  const lead = bestLead(identity);
  const evidence = metadataEvidence(identity, retrievedAt);
  const conflicts = [...identity.conflicts];

  let licenseSpdx = licenseFromMetadata(identity);

  // Evidence upgrade via guarded proxy: homepage identity + licence text
  const withinBudget = () =>
    ctx.spent.pages < ctx.budget.pages && Date.now() < ctx.deadline && !ctx.signal?.aborted;

  if (ctx.proxyAvailable && identity.homepage && withinBudget()) {
    ctx.spent.pages += 1;
    ctx.spent.requests += 1;
    const page = await fetchPageViaProxy(identity.homepage);
    if (page?.title) {
      evidence.push({
        claim: `Official site: "${page.title}"${page.description ? ` — ${page.description.slice(0, 160)}` : ''}`,
        source: 'official-site',
        sourceUrl: page.finalUrl,
        retrievedAt: page.retrievedAt,
        confidence: 'high',
        sourceType: 'retrieved-content',
      });
    }
  }

  // Licence verification from retrieved content when metadata is silent
  const repoUrl = identity.canonicalRepoUrl;
  if (ctx.proxyAvailable && !licenseSpdx && repoUrl && withinBudget()) {
    const licenseUrls = licenseFileUrls(repoUrl);
    for (const licenseUrl of licenseUrls) {
      if (!withinBudget()) break;
      ctx.spent.pages += 1;
      ctx.spent.requests += 1;
      const page = await fetchPageViaProxy(licenseUrl);
      if (page?.licenseSpdx) {
        licenseSpdx = page.licenseSpdx;
        evidence.push({
          claim: `Licence verified as ${page.licenseSpdx} from licence file`,
          source: 'licence-file',
          sourceUrl: page.finalUrl,
          retrievedAt: page.retrievedAt,
          confidence: 'high',
          sourceType: 'retrieved-content',
        });
        break;
      }
    }
  }

  // Security evidence when a package identity exists
  const packageLead = identity.leads.find((l) => l.packageName && l.ecosystem);
  if (packageLead && withinBudget()) {
    ctx.spent.requests += 1;
    const vulns = await fetchVulns(packageLead.ecosystem!, packageLead.packageName!);
    evidence.push(...vulns.map((v) => ({ ...v, sourceType: 'structured-metadata' as const })));
  }

  const stars = Math.max(0, ...identity.leads.map((l) => l.metadata?.stars ?? 0));
  const language = identity.leads.map((l) => l.metadata?.language).find(Boolean) ?? 'Unknown';
  const lastActivity =
    identity.leads
      .map((l) => l.metadata?.lastActivity)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop() ?? retrievedAt;

  return {
    id: identity.id,
    name: identity.displayName,
    description: cleanDescription(lead.snippet ?? ''),
    repoUrl: identity.canonicalRepoUrl ?? lead.url,
    projectUrl: identity.homepage,
    license: licenseSpdx ?? 'Unknown',
    licenseClassification: conflicts.some((c) => c.includes('licence'))
      ? 'unknown'
      : classifyLicense(licenseSpdx),
    lastRelease: lastActivity,
    stars,
    language,
    deploymentModes: ['self-hosted'],
    evidence,
    aliases: identity.aliases,
    conflicts,
    sources: [...new Set(identity.leads.map((l) => l.sourceId))],
  };
}

/** Likely raw licence file locations for known forges. */
export function licenseFileUrls(repoUrl: string): string[] {
  try {
    const url = new URL(repoUrl);
    const [owner, name] = url.pathname.split('/').filter(Boolean);
    if (!owner || !name) return [];
    if (url.hostname === 'github.com') {
      return [
        `https://raw.githubusercontent.com/${owner}/${name}/HEAD/LICENSE`,
        `https://raw.githubusercontent.com/${owner}/${name}/HEAD/LICENSE.md`,
      ];
    }
    if (url.hostname === 'gitlab.com') {
      return [`https://gitlab.com/${owner}/${name}/-/raw/HEAD/LICENSE`];
    }
    if (url.hostname === 'codeberg.org') {
      return [`https://codeberg.org/${owner}/${name}/raw/branch/main/LICENSE`];
    }
    return [];
  } catch {
    return [];
  }
}
