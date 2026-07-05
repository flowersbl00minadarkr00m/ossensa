import { describe, it, expect } from 'vitest';
import { extractConstraints, rankCandidates, applyResultCap, scoreCandidate } from '../src/domain/search';
import type { Candidate, Constraint } from '../src/domain/types';

function makeCandidate(partial: Partial<Candidate>): Candidate {
  return {
    id: 'c-1',
    name: 'Test',
    description: 'A test candidate',
    repoUrl: 'https://github.com/test/test',
    license: 'MIT',
    lastRelease: '2025-01-01',
    stars: 100,
    language: 'TypeScript',
    deploymentModes: ['self-hosted'],
    evidence: [],
    constraintCoverage: {
      required: { met: [], missed: [] },
      preferred: { met: [], missed: [] },
      disqualified: false,
      disqualifyingConstraints: [],
    },
    ...partial,
  };
}

describe('extractConstraints', () => {
  it('returns empty array for empty input', () => {
    expect(extractConstraints('')).toEqual([]);
    expect(extractConstraints('   ')).toEqual([]);
  });

  it('splits on commas', () => {
    const result = extractConstraints('REST API, self-hosted, Docker support');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('detects required category by default', () => {
    const result = extractConstraints('REST API support');
    expect(result[0].category).toBe('required');
  });

  it('detects not-acceptable from negative keywords', () => {
    const result = extractConstraints('no Docker required');
    expect(result.some((c) => c.category === 'not-acceptable')).toBe(true);
  });
});

describe('rankCandidates + applyResultCap', () => {
  const constraints: Constraint[] = [
    { id: 'c1', text: 'self-hosted', category: 'required', createdAt: '' },
    { id: 'c2', text: 'REST API', category: 'preferred', createdAt: '' },
  ];

  const candidates: Candidate[] = [
    makeCandidate({ id: 'a', name: 'Alpha', description: 'self-hosted REST API tool' }),
    makeCandidate({ id: 'b', name: 'Beta', description: 'self-hosted workflow engine' }),
    makeCandidate({ id: 'c', name: 'Gamma', description: 'hosted SaaS REST API platform' }),
    makeCandidate({ id: 'd', name: 'Delta', description: 'CLI utility tool' }),
    makeCandidate({ id: 'e', name: 'Epsilon', description: 'self-hosted Docker container REST' }),
    makeCandidate({ id: 'f', name: 'Zeta', description: 'self-hosted system monitor REST API integration' }),
  ];

  it('enforces cap at 5', () => {
    const ranked = rankCandidates(candidates, constraints);
    const capped = applyResultCap(ranked);
    expect(capped.length).toBeLessThanOrEqual(5);
  });

  it('ranks self-hosted+REST candidates above hosted-only', () => {
    const ranked = rankCandidates(candidates, constraints);
    const alphaIdx = ranked.findIndex((c) => c.id === 'a');
    const gammaIdx = ranked.findIndex((c) => c.id === 'c');
    // Alpha (self-hosted + REST) should beat Gamma (hosted, no self-hosted)
    if (gammaIdx !== -1) {
      expect(alphaIdx).toBeLessThan(gammaIdx);
    }
  });

  it('disqualifies candidates matching not-acceptable constraints', () => {
    const notAcceptable: Constraint[] = [
      { id: 'na1', text: 'Docker', category: 'not-acceptable', createdAt: '' },
    ];
    const dockerCandidate = makeCandidate({ id: 'docker', name: 'DockerApp', description: 'Docker-based container platform' });
    const score = scoreCandidate(dockerCandidate, notAcceptable);
    expect(score).toBe(-Infinity);

    const ranked = rankCandidates([dockerCandidate], notAcceptable);
    expect(ranked).toHaveLength(0);
  });

  it('applyResultCap never exceeds cap regardless of input size', () => {
    const large = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ id: `l${i}`, name: `Tool${i}`, description: `self-hosted REST tool ${i}` }),
    );
    const capped = applyResultCap(rankCandidates(large, constraints));
    expect(capped.length).toBeLessThanOrEqual(5);
  });
});
