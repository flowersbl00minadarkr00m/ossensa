/**
 * Search-quality benchmark (FR-010). Network-dependent by design — run with
 * `npm run benchmark`, not as part of `npm test`. Release gate: a known
 * credible candidate must appear in the top five for >= 75% of intents.
 */
import { describe, it, expect } from 'vitest';
import { runWebDiscovery } from '../../src/lib/discovery/orchestrator';
import type { SearchQuery } from '../../src/domain/types';
import benchmark from './intents.json';

interface Intent {
  id: string;
  domain: string;
  query: string;
  expectedAny: string[];
}

function makeQuery(text: string): SearchQuery {
  return {
    id: `bench-${Date.now()}`,
    naturalLanguage: text,
    constraints: [],
    submittedAt: new Date().toISOString(),
    source: 'manual',
  };
}

describe('search-quality benchmark v' + benchmark.version, () => {
  it(
    `puts a known credible candidate in the top 5 for >= ${benchmark.gate * 100}% of intents`,
    { timeout: 10 * 60 * 1000 },
    async () => {
      const intents = benchmark.intents as Intent[];
      const results: Array<{ id: string; hit: boolean; top: string[] }> = [];

      for (const intent of intents) {
        const { candidates } = await runWebDiscovery(makeQuery(intent.query), {
          proxyAvailable: false,
        });
        const names = candidates.map((c) =>
          `${c.name} ${c.aliases?.join(' ') ?? ''}`.toLowerCase(),
        );
        const hit = intent.expectedAny.some((expected) =>
          names.some((name) => name.includes(expected.toLowerCase())),
        );
        results.push({ id: intent.id, hit, top: candidates.map((c) => c.name) });
        // Be polite to public APIs between intents
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const hitRate = results.filter((r) => r.hit).length / results.length;
      // eslint-disable-next-line no-console
      console.table(results.map((r) => ({ intent: r.id, hit: r.hit ? '✓' : '✗', top5: r.top.join(', ') })));
      // eslint-disable-next-line no-console
      console.log(`Benchmark v${benchmark.version} hit rate: ${(hitRate * 100).toFixed(0)}% (gate ${benchmark.gate * 100}%)`);

      expect(hitRate).toBeGreaterThanOrEqual(benchmark.gate);
    },
  );
});
