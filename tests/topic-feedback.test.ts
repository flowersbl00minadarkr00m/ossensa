import { describe, it, expect } from 'vitest';
import { deriveTopicFeedbackQueries } from '../src/lib/discovery/topicFeedback';
import { runWebDiscovery } from '../src/lib/discovery/orchestrator';
import type { CandidateIdentity, DiscoveryLead, SourceAdapter } from '../src/lib/discovery/types';
import type { IntentTerms } from '../src/lib/discovery/relevance';
import type { SearchQuery } from '../src/domain/types';

function lead(partial: Partial<DiscoveryLead>): DiscoveryLead {
  return {
    sourceId: 'github',
    title: 'owner/project',
    url: 'https://github.com/owner/project',
    sourceType: 'structured-metadata',
    ...partial,
  };
}

function identity(name: string, topicsPerLead: string[][]): CandidateIdentity {
  return {
    id: `id-${name}`,
    displayName: name,
    leads: topicsPerLead.map((topics, i) =>
      lead({ title: name, url: `https://github.com/${name}-${i}`, metadata: { topics } }),
    ),
    aliases: [],
    conflicts: [],
  };
}

const terms: IntentTerms = { phrases: ['home automation'], words: ['home', 'automation'] };

describe('deriveTopicFeedbackQueries', () => {
  it('surfaces topics shared by >=2 on-topic candidates, excluding intent-covered words', () => {
    const ids = [
      identity('a/one', [['smart-home', 'iot', 'home-automation']]),
      identity('b/two', [['smart-home', 'iot']]),
      identity('c/three', [['zwave']]), // only one candidate -> not corroborated
    ];
    const out = deriveTopicFeedbackQueries(ids, terms, 2);
    // home-automation is fully covered by intent words -> dropped.
    // smart-home and iot each appear in 2 candidates; ties break alphabetically.
    expect(out).toEqual(['iot', 'smart home']);
    expect(out).not.toContain('home automation');
  });

  it('counts a topic once per candidate, not once per lead', () => {
    // One candidate tagged iot on two leads must NOT reach the >=2 threshold.
    const ids = [identity('a/one', [['iot'], ['iot']])];
    expect(deriveTopicFeedbackQueries(ids, terms, 2)).toEqual([]);
  });

  it('respects the max cap and is deterministic', () => {
    const ids = [
      identity('a', [['alpha-tag', 'beta-tag', 'gamma-tag']]),
      identity('b', [['alpha-tag', 'beta-tag', 'gamma-tag']]),
    ];
    expect(deriveTopicFeedbackQueries(ids, terms, 1)).toEqual(['alpha tag']);
    expect(deriveTopicFeedbackQueries(ids, terms, 5)).toEqual(['alpha tag', 'beta tag', 'gamma tag']);
  });
});

function makeQuery(text: string): SearchQuery {
  return { id: 'q', naturalLanguage: text, constraints: [], submittedAt: '', source: 'manual' };
}

describe('runWebDiscovery pseudo-relevance feedback', () => {
  it('runs a topic follow-up pass that surfaces a candidate the intent queries missed', async () => {
    const searched: string[] = [];
    // The base repos share the "iot" topic (not a word in the intent), so the
    // feedback pass queries "iot" — and only that query reveals tasmota.
    const github: SourceAdapter = {
      id: 'github',
      label: 'GitHub',
      kind: 'forge',
      async search(query: string): Promise<DiscoveryLead[]> {
        searched.push(query);
        if (/\biot\b/i.test(query)) {
          return [
            lead({
              title: 'arendst/Tasmota',
              url: 'https://github.com/arendst/Tasmota',
              repoUrl: 'https://github.com/arendst/Tasmota',
              snippet: 'Alternative firmware for ESP-based IoT home automation devices',
              metadata: { stars: 22000, licenseSpdx: 'GPL-3.0', topics: ['iot', 'home-automation'] },
            }),
          ];
        }
        return [
          lead({
            title: 'home-assistant/core',
            url: 'https://github.com/home-assistant/core',
            repoUrl: 'https://github.com/home-assistant/core',
            snippet: 'Open source home automation',
            metadata: { stars: 70000, licenseSpdx: 'Apache-2.0', topics: ['iot', 'home-automation'] },
          }),
          lead({
            title: 'domoticz/domoticz',
            url: 'https://github.com/domoticz/domoticz',
            repoUrl: 'https://github.com/domoticz/domoticz',
            snippet: 'Home automation system',
            metadata: { stars: 4000, licenseSpdx: 'GPL-3.0', topics: ['iot', 'home-automation'] },
          }),
        ];
      },
    };

    const { candidates, coverage } = await runWebDiscovery(makeQuery('home automation'), {
      adapters: [github],
      proxyAvailable: false,
    });

    // "iot" (a shared candidate topic, absent from the intent) became a follow-up.
    expect(searched).toContain('iot');
    expect(coverage.feedbackQueries).toContain('iot');
    expect(coverage.gaps.some((g) => g.includes('follow-up'))).toBe(true);

    // Tasmota is only reachable through the feedback pass, yet appears in results.
    expect(candidates.map((c) => c.name)).toContain('arendst/Tasmota');
  });

  it('does not run a feedback pass when candidates carry no shared topics', async () => {
    const searched: string[] = [];
    const github: SourceAdapter = {
      id: 'github',
      label: 'GitHub',
      kind: 'forge',
      async search(query: string): Promise<DiscoveryLead[]> {
        searched.push(query);
        return [
          lead({
            title: 'home-assistant/core',
            repoUrl: 'https://github.com/home-assistant/core',
            snippet: 'Open source home automation',
            metadata: { stars: 70000, licenseSpdx: 'Apache-2.0' }, // no topics
          }),
        ];
      },
    };
    const { coverage } = await runWebDiscovery(makeQuery('home automation'), {
      adapters: [github],
      proxyAvailable: false,
    });
    expect(coverage.feedbackQueries).toBeUndefined();
    expect(coverage.gaps.some((g) => g.includes('follow-up'))).toBe(false);
  });
});
