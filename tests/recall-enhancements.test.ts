import { describe, it, expect } from 'vitest';
import { extractKeywords, expandQueries, planAdapterQueries } from '../src/lib/discovery/expandQueries';
import { stemWord, topicalMatch } from '../src/lib/discovery/relevance';
import { resolveIdentities } from '../src/lib/discovery/resolveIdentities';
import type { DiscoveryLead } from '../src/lib/discovery/types';
import type { IntentTerms } from '../src/lib/discovery/relevance';
import type { Constraint, SearchQuery } from '../src/domain/types';

function lead(partial: Partial<DiscoveryLead>): DiscoveryLead {
  return {
    sourceId: 'github',
    title: 'owner/project',
    url: 'https://github.com/owner/project',
    sourceType: 'structured-metadata',
    ...partial,
  };
}

function constraint(text: string, category: Constraint['category'] = 'required'): Constraint {
  return { id: text, text, category, createdAt: '' };
}

function query(text: string, constraints: Constraint[] = []): SearchQuery {
  return { id: 'q', naturalLanguage: text, constraints, submittedAt: '', source: 'manual' };
}

// ── Idea #2a: salience-aware keyword extraction ──────────────────────────────

describe('extractKeywords salience', () => {
  it('preserves original order when under the cap', () => {
    expect(extractKeywords('home appliance automation')).toEqual([
      'home',
      'appliance',
      'automation',
    ]);
  });

  it('keeps a distinctive late term instead of truncating it as filler', () => {
    // 7 meaningful words, cap 5. Naive first-5 would drop "calibre".
    const intent = 'data system server photo library backup calibre';
    const kept = extractKeywords(intent);
    expect(kept).toHaveLength(5);
    expect(kept).toContain('calibre');
    expect(kept).toContain('photo');
    expect(kept).toContain('backup');
    // Common filler is demoted; generic late words are dropped first.
    expect(kept).not.toContain('library');
  });

  it('is deterministic for a given intent', () => {
    const intent = 'data system server photo library backup calibre';
    expect(extractKeywords(intent)).toEqual(extractKeywords(intent));
  });
});

// ── Idea #2b: naive plural stemming ──────────────────────────────────────────

describe('stemWord', () => {
  it('strips trailing plural markers', () => {
    expect(stemWord('dashboards')).toBe('dashboard');
    expect(stemWord('processes')).toBe('process');
    expect(stemWord('apis')).toBe('api');
  });

  it('leaves short words and double-s endings untouched', () => {
    expect(stemWord('is')).toBe('is');
    expect(stemWord('class')).toBe('class');
    expect(stemWord('css')).toBe('css');
  });
});

describe('topicalMatch stemming', () => {
  function identity(snippet: string, title = 'acme/metrics-ui') {
    return resolveIdentities([
      lead({ title, repoUrl: `https://github.com/${title}`, snippet }),
    ]).identities[0];
  }

  it('matches a plural intent term against a singular in the text', () => {
    const id = identity('a self-hosted dashboard for team metrics');
    const plural: IntentTerms = { phrases: [], words: ['dashboards'] };
    expect(topicalMatch(id, plural)).toBeGreaterThan(0);
    // The singular form still matches too (regression guard).
    const singular: IntentTerms = { phrases: [], words: ['dashboard'] };
    expect(topicalMatch(id, singular)).toBeGreaterThan(0);
  });

  it('does not manufacture matches for unrelated terms', () => {
    const id = identity('a self-hosted dashboard for team metrics');
    const off: IntentTerms = { phrases: [], words: ['calibre'] };
    expect(topicalMatch(id, off)).toBe(0);
  });
});

// ── Idea #3: per-adapter query routing ───────────────────────────────────────

describe('planAdapterQueries', () => {
  it('gives registries the keyword query plus a single distinctive token', () => {
    const ex = expandQueries(query('home appliance automation'));
    const plan = planAdapterQueries('registry', ex, 2);
    expect(plan).toEqual(['home appliance automation', 'home']);
    // No multi-word category phrase is sent to name-biased registry search.
    expect(plan.some((q) => q === 'smart home platform')).toBe(false);
  });

  it('gives forges the descriptive category phrases', () => {
    const ex = expandQueries(query('home appliance automation'));
    const plan = planAdapterQueries('forge', ex, 2);
    expect(plan).toContain('home automation');
    expect(plan).toContain('smart home platform');
  });

  it('rotates a required-constraint query into the forge set', () => {
    // No category match, so phrases are empty and the constraint takes priority.
    const ex = expandQueries(query('widget frobnicator', [constraint('rust')]));
    const plan = planAdapterQueries('forge', ex, 2);
    expect(plan[0]).toBe('rust');
    expect(plan).toContain('widget frobnicator');
  });

  it('never leaves a source with no query when the intent has no category match', () => {
    const ex = expandQueries(query('widget frobnicator'));
    expect(planAdapterQueries('forge', ex, 2)).toEqual(['widget frobnicator']);
    expect(planAdapterQueries('registry', ex, 2)).toEqual(['widget frobnicator', 'widget']);
    expect(planAdapterQueries('directory', ex, 2).length).toBeGreaterThan(0);
  });

  it('is bounded by the limit and deterministic', () => {
    const ex = expandQueries(query('home appliance automation'));
    expect(planAdapterQueries('forge', ex, 2)).toHaveLength(2);
    expect(planAdapterQueries('forge', ex, 2)).toEqual(planAdapterQueries('forge', ex, 2));
  });
});
