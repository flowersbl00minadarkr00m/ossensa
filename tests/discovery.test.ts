import { describe, it, expect } from 'vitest';
import { expandQueries, cleanIntent } from '../src/lib/discovery/expandQueries';
import {
  normalizeRepoUrl,
  normalizeName,
  resolveIdentities,
} from '../src/lib/discovery/resolveIdentities';
import { describeGaps } from '../src/lib/discovery/coverage';
import { buildIntentTerms, isCuratedListLead, scoreRelevance } from '../src/lib/discovery/relevance';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  validatePublicUrl,
} from '../src/lib/discovery/urlGuard';
import { classifyLicense } from '../src/lib/spdxAdapter';
import { licenseFileUrls } from '../src/lib/discovery/gatherEvidence';
import { runWebDiscovery } from '../src/lib/discovery/orchestrator';
import { scoreCandidate } from '../src/domain/search';
import type { Candidate, SearchQuery } from '../src/domain/types';
import type { DiscoveryLead, SourceAdapter, SourceCoverage } from '../src/lib/discovery/types';
import { AdapterError } from '../src/lib/discovery/types';

function makeQuery(text: string): SearchQuery {
  return { id: 'q', naturalLanguage: text, constraints: [], submittedAt: '', source: 'manual' };
}

function lead(partial: Partial<DiscoveryLead>): DiscoveryLead {
  return {
    sourceId: 'github',
    title: 'owner/project',
    url: 'https://github.com/owner/project',
    sourceType: 'structured-metadata',
    ...partial,
  };
}

// ── FR-002: query expansion ──────────────────────────────────────────────────

describe('expandQueries', () => {
  it('keeps the original intent and adds category expansions', () => {
    const { original, queries } = expandQueries(makeQuery('I need home appliance automation'));
    expect(original).toBe('home appliance automation');
    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries).toContain('home automation');
  });

  it('is bounded', () => {
    const { queries } = expandQueries(
      makeQuery('home automation workflow password note photo dashboard monitor video finance file security vector chat'),
    );
    expect(queries.length).toBeLessThanOrEqual(6);
  });

  it('returns no queries for empty intent', () => {
    expect(expandQueries(makeQuery('   ')).queries).toHaveLength(0);
  });

  it('strips request framing', () => {
    expect(cleanIntent("I'm looking for a password manager")).toBe('a password manager');
  });
});

// ── FR-003: identity resolution ──────────────────────────────────────────────

describe('resolveIdentities', () => {
  it('merges the same repo across forge and registry sources', () => {
    const { identities } = resolveIdentities([
      lead({ sourceId: 'github', title: 'n8n-io/n8n', repoUrl: 'https://github.com/n8n-io/n8n' }),
      lead({
        sourceId: 'npm',
        title: 'n8n-workflow',
        url: 'https://www.npmjs.com/package/n8n-workflow',
        repoUrl: 'https://github.com/n8n-io/n8n.git',
        packageName: 'n8n-workflow',
        ecosystem: 'npm',
      }),
    ]);
    expect(identities).toHaveLength(1);
    expect(identities[0].leads).toHaveLength(2);
    expect(identities[0].aliases).toContain('n8n-workflow');
  });

  it('keeps same-name different-repo projects separate', () => {
    const { identities } = resolveIdentities([
      lead({ title: 'alpha/tool', repoUrl: 'https://github.com/alpha/tool' }),
      lead({ title: 'beta/tool', repoUrl: 'https://gitlab.com/beta/tool', sourceId: 'gitlab' }),
    ]);
    expect(identities).toHaveLength(2);
  });

  it('records licence conflicts instead of resolving them', () => {
    const { identities } = resolveIdentities([
      lead({ repoUrl: 'https://github.com/o/p', metadata: { licenseSpdx: 'MIT' } }),
      lead({
        sourceId: 'npm',
        title: 'p',
        url: 'https://npmjs.com/package/p',
        repoUrl: 'https://github.com/o/p',
        metadata: { licenseSpdx: 'AGPL-3.0' },
      }),
    ]);
    expect(identities[0].conflicts.some((c) => c.includes('MIT'))).toBe(true);
  });

  it('quarantines snippet-only leads as unverified', () => {
    const { identities, unverifiedLeads } = resolveIdentities([
      lead({
        sourceId: 'wikipedia',
        title: 'Some Software',
        url: 'https://en.wikipedia.org/wiki/Some_Software',
        repoUrl: undefined,
        sourceType: 'search-snippet',
      }),
    ]);
    expect(identities).toHaveLength(0);
    expect(unverifiedLeads).toHaveLength(1);
  });

  it('merges snippet leads onto matching verified identities by name', () => {
    const { identities, unverifiedLeads } = resolveIdentities([
      lead({ title: 'home-assistant/core', repoUrl: 'https://github.com/home-assistant/core' }),
      lead({
        sourceId: 'wikipedia',
        title: 'core',
        url: 'https://en.wikipedia.org/wiki/Home_Assistant',
        repoUrl: undefined,
        sourceType: 'search-snippet',
      }),
    ]);
    expect(identities).toHaveLength(1);
    expect(unverifiedLeads).toHaveLength(0);
    expect(identities[0].leads).toHaveLength(2);
  });

  it('normalizes repo URLs', () => {
    expect(normalizeRepoUrl('https://github.com/Owner/Repo.git')).toBe('github.com/owner/repo');
    expect(normalizeRepoUrl('git+https://github.com/o/r')).toBe('github.com/o/r');
    expect(normalizeRepoUrl('not a url')).toBeUndefined();
    expect(normalizeName('n8n-io/N8N')).toBe('n8n');
  });
});

// ── NFR-001: SSRF guard ──────────────────────────────────────────────────────

describe('urlGuard', () => {
  it('rejects private and reserved IPv4 ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
      expect(isPrivateIPv4(ip), ip).toBe(true);
    }
    expect(isPrivateIPv4('140.82.112.3')).toBe(false);
    expect(isPrivateIPv4('999.1.1.1')).toBe(true); // malformed → unsafe
  });

  it('rejects private IPv6 forms', () => {
    for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:192.168.0.1']) {
      expect(isPrivateIPv6(ip), ip).toBe(true);
    }
    expect(isPrivateIPv6('2606:4700::6810:84e5')).toBe(false);
  });

  it('blocks unsafe URLs before any fetch', () => {
    expect(validatePublicUrl('file:///etc/passwd').ok).toBe(false);
    expect(validatePublicUrl('http://localhost/admin').ok).toBe(false);
    expect(validatePublicUrl('http://127.0.0.1:8080/').ok).toBe(false);
    expect(validatePublicUrl('http://[::1]/').ok).toBe(false);
    expect(validatePublicUrl('http://printer.local/').ok).toBe(false);
    expect(validatePublicUrl('http://intranet/').ok).toBe(false);
    expect(validatePublicUrl('http://user:pass@example.com/').ok).toBe(false);
    expect(validatePublicUrl('https://example.com/page').ok).toBe(true);
  });
});

// ── FR-005: licence gate ─────────────────────────────────────────────────────

describe('licence gate', () => {
  it('classifies only evidence-backed SPDX ids as OSI open source', () => {
    expect(classifyLicense('MIT')).toBe('osi-open-source');
    expect(classifyLicense('AGPL-3.0')).toBe('osi-open-source');
    expect(classifyLicense('BUSL-1.1')).toBe('source-available');
    expect(classifyLicense('SSPL-1.0')).toBe('source-available');
    expect(classifyLicense(undefined)).toBe('unknown');
    expect(classifyLicense('NOASSERTION')).toBe('unknown');
    expect(classifyLicense('SomeMadeUpLicense')).toBe('unknown');
  });

  it('knows raw licence file locations per forge', () => {
    expect(licenseFileUrls('https://github.com/o/r')[0]).toContain('raw.githubusercontent.com/o/r');
    expect(licenseFileUrls('https://gitlab.com/o/r')[0]).toContain('gitlab.com/o/r/-/raw');
    expect(licenseFileUrls('https://example.com/x')).toHaveLength(0);
  });
});

// ── FR-007: ranking penalties ────────────────────────────────────────────────

describe('ranking penalties', () => {
  const base: Candidate = {
    id: 'c',
    name: 'Tool',
    description: 'self-hosted tool',
    repoUrl: 'https://github.com/o/r',
    license: 'MIT',
    licenseClassification: 'osi-open-source',
    lastRelease: '2026-01-01',
    stars: 10,
    language: 'Go',
    deploymentModes: ['self-hosted'],
    evidence: [],
    constraintCoverage: {
      required: { met: [], missed: [] },
      preferred: { met: [], missed: [] },
      disqualified: false,
      disqualifyingConstraints: [],
    },
  };

  it('penalizes unknown licence classification and conflicts', () => {
    const clean = scoreCandidate(base, []);
    const unknown = scoreCandidate({ ...base, licenseClassification: 'unknown' }, []);
    const conflicted = scoreCandidate({ ...base, conflicts: ['licence conflict'] }, []);
    expect(unknown).toBeLessThan(clean);
    expect(conflicted).toBeLessThan(clean);
  });
});

// ── FR-001/FR-008: orchestrator isolation and coverage ───────────────────────

function stubAdapter(
  id: SourceAdapter['id'],
  behavior: () => Promise<DiscoveryLead[]>,
): SourceAdapter {
  return { id, label: id, kind: 'forge', search: behavior };
}

describe('runWebDiscovery', () => {
  it('keeps healthy sources when one source fails and reports coverage', async () => {
    const good = stubAdapter('github', async () => [
      lead({
        title: 'home-assistant/core',
        repoUrl: 'https://github.com/home-assistant/core',
        snippet: 'Open source home automation',
        metadata: { stars: 70000, licenseSpdx: 'Apache-2.0', language: 'Python', lastActivity: '2026-07-01' },
      }),
    ]);
    const bad = stubAdapter('gitlab', async () => {
      throw new AdapterError('rate-limited', 'Rate limited');
    });

    const { candidates, coverage } = await runWebDiscovery(
      makeQuery('home automation'),
      { adapters: [good, bad], proxyAvailable: false },
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('home-assistant/core');
    expect(candidates[0].licenseClassification).toBe('osi-open-source');

    const gitlabCoverage = coverage.sources.find((s: SourceCoverage) => s.sourceId === 'gitlab');
    expect(gitlabCoverage?.status).toBe('rate-limited');
    expect(gitlabCoverage?.retryable).toBe(true);
    expect(coverage.gaps.some((g) => g.includes('rate-limited'))).toBe(true);
  });

  it('returns empty (never demo data) when every source fails', async () => {
    const bad = stubAdapter('github', async () => {
      throw new AdapterError('failed', 'boom');
    });
    const { candidates, coverage } = await runWebDiscovery(makeQuery('home automation'), {
      adapters: [bad],
      proxyAvailable: false,
    });
    expect(candidates).toHaveLength(0);
    expect(coverage.sources[0].status).toBe('failed');
  });

  it('caps results at five', async () => {
    const many = stubAdapter('github', async () =>
      Array.from({ length: 12 }, (_, i) =>
        lead({
          title: `owner/tool${i}`,
          url: `https://github.com/owner/tool${i}`,
          repoUrl: `https://github.com/owner/tool${i}`,
          metadata: { stars: 100 - i, licenseSpdx: 'MIT' },
        }),
      ),
    );
    const { candidates } = await runWebDiscovery(makeQuery('home automation'), {
      adapters: [many],
      proxyAvailable: false,
    });
    expect(candidates.length).toBeLessThanOrEqual(5);
  });
});

// ── FR-007: relevance over popularity ────────────────────────────────────────

describe('relevance', () => {
  it('flags curated lists, tutorials, and roadmaps', () => {
    expect(isCuratedListLead(lead({ title: 'sindresorhus/awesome' }))).toBe(true);
    expect(isCuratedListLead(lead({ title: 'public-apis/public-apis' }))).toBe(true);
    expect(isCuratedListLead(lead({ title: 'avelino/awesome-go' }))).toBe(true);
    expect(isCuratedListLead(lead({ title: 'trimstray/the-book-of-secret-knowledge' }))).toBe(true);
    expect(isCuratedListLead(lead({ title: 'codecrafters-io/build-your-own-x' }))).toBe(true);
    expect(isCuratedListLead(lead({ title: 'home-assistant/core' }))).toBe(false);
    expect(isCuratedListLead(lead({ title: 'immich-app/immich' }))).toBe(false);
  });

  it('ranks an on-topic project above a bigger off-topic repo', () => {
    const terms = buildIntentTerms('home automation for my house', ['home automation', 'smart home platform']);
    const onTopic = resolveIdentities([
      lead({
        title: 'home-assistant/core',
        repoUrl: 'https://github.com/home-assistant/core',
        snippet: 'Open source home automation that puts local control first',
        metadata: { stars: 70000 },
      }),
    ]).identities[0];
    const offTopic = resolveIdentities([
      lead({
        title: 'facebook/react',
        repoUrl: 'https://github.com/facebook/react',
        snippet: 'The library for web and native user interfaces',
        metadata: { stars: 230000 },
      }),
    ]).identities[0];
    expect(scoreRelevance(onTopic, terms)).toBeGreaterThan(scoreRelevance(offTopic, terms));
    expect(scoreRelevance(offTopic, terms)).toBe(0);
  });
});

// ── US-003: gap descriptions ─────────────────────────────────────────────────

describe('describeGaps', () => {
  it('explains proxy unavailability and unverified leads in plain language', () => {
    const gaps = describeGaps([], false, false, 3);
    expect(gaps.some((g) => g.includes('Official-site evidence'))).toBe(true);
    expect(gaps.some((g) => g.includes('3 discovery leads'))).toBe(true);
  });
});
