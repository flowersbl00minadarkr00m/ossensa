import type { Candidate, Constraint } from './types';

// ── Keyword extraction ──────────────────────────────────────────────────────

const PREFERRED_KEYWORDS = [
  'prefer', 'preferred', 'ideally', 'nice to have', 'would like', 'bonus',
  'should', 'better if', 'good if',
];

const NOT_ACCEPTABLE_KEYWORDS = [
  'not', "don't", 'no ', 'without', 'avoid', 'exclude', 'never', 'reject',
  'unacceptable', 'cannot', "can't", 'disqualify',
];

function detectCategory(text: string): Constraint['category'] {
  const lower = text.toLowerCase();
  if (NOT_ACCEPTABLE_KEYWORDS.some((k) => lower.includes(k))) return 'not-acceptable';
  if (PREFERRED_KEYWORDS.some((k) => lower.includes(k))) return 'preferred';
  return 'required';
}

/**
 * Keyword-based constraint extractor — no AI, fully deterministic.
 * Splits natural-language input on delimiters and assigns categories.
 */
export function extractConstraints(naturalLanguage: string): Constraint[] {
  if (!naturalLanguage.trim()) return [];

  // Split on commas, semicolons, "and", "with", "that"
  const raw = naturalLanguage
    .split(/[,;]|(?:\band\b)|(?:\bthat\b)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  return raw.map((text, i) => ({
    id: `c-${Date.now()}-${i}`,
    text: text.charAt(0).toUpperCase() + text.slice(1),
    category: detectCategory(text),
    createdAt: new Date().toISOString(),
  }));
}

// ── Constraint matching ─────────────────────────────────────────────────────

/**
 * Check whether a candidate's description / metadata satisfies a constraint.
 * Simple keyword overlap — deterministic, no network.
 */
export function candidateMeetsConstraint(candidate: Candidate, constraint: Constraint): boolean {
  const haystack = [
    candidate.name,
    candidate.description,
    candidate.language,
    candidate.license,
    ...(candidate.deploymentModes ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const qualifierWords = new Set([
    'required', 'require', 'requires', 'must', 'should', 'prefer', 'preferred',
    'without', 'avoid', 'exclude', 'cannot', 'never', 'acceptable',
  ]);
  const words = [...new Set(constraint.text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !qualifierWords.has(word)))];

  if (words.length === 0) return false;
  const matchedWords = words.filter((word) => haystack.includes(word)).length;
  return matchedWords >= Math.ceil(words.length * 0.6);
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/**
 * Score a candidate against constraints.
 * Required coverage weighted 2×, preferred 1×.
 * Disqualifying not-acceptable constraints eliminate the candidate.
 */
export function scoreCandidate(candidate: Candidate, constraints: Constraint[]): number {
  const required = constraints.filter((c) => c.category === 'required');
  const preferred = constraints.filter((c) => c.category === 'preferred');
  const notAcceptable = constraints.filter((c) => c.category === 'not-acceptable');

  // Disqualify on any not-acceptable match
  if (notAcceptable.some((c) => candidateMeetsConstraint(candidate, c))) return -Infinity;

  const requiredScore =
    required.length > 0
      ? required.filter((c) => candidateMeetsConstraint(candidate, c)).length / required.length
      : 1;

  const preferredScore =
    preferred.length > 0
      ? preferred.filter((c) => candidateMeetsConstraint(candidate, c)).length / preferred.length
      : 0;

  // Unknowns and conflicts are penalized, never hidden (FR-007, NFR-004).
  // Legacy candidates without a classification are not penalized.
  const unknownPenalty = candidate.licenseClassification === 'unknown' ? 0.15 : 0;
  const conflictPenalty = 0.1 * (candidate.conflicts?.length ?? 0);

  return requiredScore * 2 + preferredScore - unknownPenalty - conflictPenalty;
}

/**
 * Rank candidates by constraint score, exclude disqualified, return ordered list.
 */
export function rankCandidates(candidates: Candidate[], constraints: Constraint[]): Candidate[] {
  return candidates
    .filter((c) => scoreCandidate(c, constraints) > -Infinity)
    .sort((a, b) => scoreCandidate(b, constraints) - scoreCandidate(a, constraints));
}

/**
 * Enforce the 5-result cap at domain layer before any UI or AI call.
 */
export function applyResultCap(candidates: Candidate[], cap = 5): Candidate[] {
  return candidates.slice(0, cap);
}
