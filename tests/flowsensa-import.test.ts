import { describe, expect, it } from 'vitest';
import { parseFlowsensaToolingRequirement } from '../src/domain/flowsensaImport';

describe('Flowsensa import validation', () => {
  it('accepts a valid tooling requirement', () => {
    const result = parseFlowsensaToolingRequirement({
      toolingRequirement: {
        description: 'Find an auditable local-first search tool',
        constraints: [{ text: 'Must run locally', category: 'required' }],
      },
    });

    expect(result.naturalLanguage).toBe('Find an auditable local-first search tool');
    expect(result.constraints).toMatchObject([{ text: 'Must run locally', category: 'required' }]);
  });

  it('rejects malformed or unrecognized constraint categories', () => {
    expect(() => parseFlowsensaToolingRequirement({})).toThrow(/toolingRequirement/);
    expect(() => parseFlowsensaToolingRequirement({
      toolingRequirement: {
        description: 'Find a tool',
        constraints: [{ text: 'No SaaS', category: 'forbidden' }],
      },
    })).toThrow(/category/);
  });
});
