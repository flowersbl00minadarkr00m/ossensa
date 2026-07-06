import type { CandidateIdentity, DiscoveryLead } from './types';

/**
 * Canonicalize a repository URL to host/owner/name for identity matching.
 * Returns undefined when the URL is not a recognizable repo URL.
 */
export function normalizeRepoUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.replace(/^git\+/, ''));
    const segments = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (segments.length < 2) return undefined;
    return `${url.hostname.toLowerCase()}/${segments[0].toLowerCase()}/${segments[1].toLowerCase()}`;
  } catch {
    return undefined;
  }
}

/** Normalize a project name for alias comparison: lowercase, alphanumeric only. */
export function normalizeName(name: string): string {
  const lastSegment = name.includes('/') ? name.split('/').pop()! : name;
  return lastSegment.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function homepageDomain(lead: DiscoveryLead): string | undefined {
  const target = lead.homepage ?? undefined;
  if (!target) return undefined;
  try {
    return new URL(target).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Merge discovery leads that refer to the same project (FR-003).
 *
 * Match keys in priority order:
 * 1. canonical repo URL
 * 2. homepage domain AND normalized name (both must match)
 *
 * Conflicting licence claims across merged leads are recorded, not resolved.
 */
export function resolveIdentities(leads: DiscoveryLead[]): {
  identities: CandidateIdentity[];
  unverifiedLeads: DiscoveryLead[];
} {
  const byRepo = new Map<string, CandidateIdentity>();
  const identities: CandidateIdentity[] = [];
  const unverifiedLeads: DiscoveryLead[] = [];

  const addLead = (identity: CandidateIdentity, lead: DiscoveryLead) => {
    identity.leads.push(lead);
    const alias = lead.title;
    if (!identity.aliases.includes(alias) && normalizeName(alias) !== normalizeName(identity.displayName)) {
      identity.aliases.push(alias);
    }
    if (!identity.homepage && lead.homepage) identity.homepage = lead.homepage;
    // Licence conflict detection across sources
    const licences = new Set(
      identity.leads
        .map((l) => l.metadata?.licenseSpdx)
        .filter((v): v is string => Boolean(v && v !== 'Unknown' && v !== 'NOASSERTION')),
    );
    if (licences.size > 1) {
      const conflict = `Conflicting licence claims across sources: ${[...licences].join(' vs ')}`;
      if (!identity.conflicts.includes(conflict)) identity.conflicts.push(conflict);
    }
  };

  // Pass 1: leads with a canonical repo URL
  for (const lead of leads) {
    const canonical = normalizeRepoUrl(lead.repoUrl);
    if (!canonical) continue;
    let identity = byRepo.get(canonical);
    if (!identity) {
      identity = {
        id: `id-${canonical.replace(/[^a-z0-9]/g, '-')}`,
        displayName: lead.title,
        canonicalRepoUrl: lead.repoUrl,
        homepage: lead.homepage,
        leads: [],
        aliases: [],
        conflicts: [],
      };
      byRepo.set(canonical, identity);
      identities.push(identity);
    }
    addLead(identity, lead);
  }

  // Pass 2: repo-less leads — homepage domain + name match, else unverified
  for (const lead of leads) {
    if (normalizeRepoUrl(lead.repoUrl)) continue;
    const domain = homepageDomain(lead);
    const name = normalizeName(lead.title);
    const match = identities.find((identity) => {
      const identityDomain = identity.homepage
        ? homepageDomain({ ...identity.leads[0], homepage: identity.homepage })
        : undefined;
      const nameMatches =
        normalizeName(identity.displayName) === name ||
        identity.aliases.some((alias) => normalizeName(alias) === name);
      if (domain && identityDomain) return domain === identityDomain && nameMatches;
      // Snippet leads (e.g. Wikipedia) may merge on exact name match alone —
      // they only contribute description evidence, never identity claims.
      return lead.sourceType === 'search-snippet' && nameMatches;
    });
    if (match) {
      addLead(match, lead);
    } else if (lead.sourceType === 'search-snippet') {
      unverifiedLeads.push(lead);
    } else {
      // Registry lead without a repo link: verifiable identity via registry page
      const identity: CandidateIdentity = {
        id: `id-${lead.sourceId}-${normalizeName(lead.title)}`,
        displayName: lead.title,
        homepage: lead.homepage,
        leads: [lead],
        aliases: [],
        conflicts: [],
      };
      identities.push(identity);
    }
  }

  // Order: most corroborated first (lead count, then stars)
  identities.sort((a, b) => {
    const starsA = Math.max(...a.leads.map((l) => l.metadata?.stars ?? 0));
    const starsB = Math.max(...b.leads.map((l) => l.metadata?.stars ?? 0));
    return b.leads.length - a.leads.length || starsB - starsA;
  });

  return { identities, unverifiedLeads };
}
