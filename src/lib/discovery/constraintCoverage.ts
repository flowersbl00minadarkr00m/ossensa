import type { Candidate, Constraint } from '../../domain/types';
import { candidateMeetsConstraint } from '../../domain/search';

/** Attach constraint coverage to a raw candidate before ranking. */
export function attachCoverage(
  raw: Omit<Candidate, 'constraintCoverage'>,
  constraints: Constraint[],
): Candidate {
  const required = constraints.filter((c) => c.category === 'required');
  const preferred = constraints.filter((c) => c.category === 'preferred');
  const notAcceptable = constraints.filter((c) => c.category === 'not-acceptable');

  const candidate = {
    ...raw,
    constraintCoverage: {
      required: { met: [], missed: [] },
      preferred: { met: [], missed: [] },
      disqualified: false,
      disqualifyingConstraints: [],
    },
  } satisfies Candidate;
  const matches = (constraint: Constraint) => candidateMeetsConstraint(candidate, constraint);
  const disqualifyingConstraints = notAcceptable.filter(matches);

  return {
    ...raw,
    constraintCoverage: {
      required: {
        met: required.filter(matches),
        missed: required.filter((constraint) => !matches(constraint)),
      },
      preferred: {
        met: preferred.filter(matches),
        missed: preferred.filter((constraint) => !matches(constraint)),
      },
      disqualified: disqualifyingConstraints.length > 0,
      disqualifyingConstraints,
    },
  };
}
