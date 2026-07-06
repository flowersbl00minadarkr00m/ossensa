import type { CandidateIdentity, DiscoveryLead } from './types';
import { extractKeywords } from './expandQueries';

/**
 * Curated lists, tutorials, and roadmaps match almost any keyword and carry
 * enormous star counts, but they are not runnable software. They are filtered
 * from candidate identities and reported in coverage.
 */
const CURATED_LIST_PATTERN =
  /\bawesome[- ]|awesome$|curated[- ](list|collection)|collection[- ]of|list[- ]of[- ](free|useful|public)|book[- ]of|roadmap|interview[- ](questions|prep)|cheat[- ]?sheets?|build[- ]your[- ]own|project[- ]based[- ]learning|tutorials?$|system[- ]design[- ]primer|public[- ]apis|free[- ]programming[- ]books/i;

export function isCuratedListLead(lead: DiscoveryLead): boolean {
  // Normalize separators so "build-your-own-x" matches "build your own".
  const text = `${lead.title} ${lead.snippet ?? ''}`.replace(/[_/]/g, '-');
  return CURATED_LIST_PATTERN.test(text);
}

export interface IntentTerms {
  /** Multi-word expansion phrases, e.g. "home automation". */
  phrases: string[];
  /** Individual meaningful words from the user's intent. */
  words: string[];
}

export function buildIntentTerms(original: string, queries: string[]): IntentTerms {
  const phrases = queries.filter((q) => q.includes(' ')).map((q) => q.toLowerCase());
  const words = extractKeywords(original.toLowerCase(), 8);
  return { phrases, words };
}

/** Topical match strength between an identity and the intent. Zero = off-topic. */
export function topicalMatch(identity: CandidateIdentity, terms: IntentTerms): number {
  const text = identity.leads
    .map((lead) => `${lead.title} ${lead.snippet ?? ''} ${(lead.metadata?.topics ?? []).join(' ')}`)
    .join(' ')
    .toLowerCase();
  const name = identity.displayName.toLowerCase();

  let score = 0;
  for (const phrase of terms.phrases) {
    if (text.includes(phrase)) score += 3;
    if (name.includes(phrase)) score += 2;
  }
  for (const word of terms.words) {
    if (name.includes(word)) score += 2;
    else if (text.includes(word)) score += 1;
  }
  return score;
}

/**
 * Credibility signal from adoption. A named project with real adoption is what
 * an adopter wants; an obscure micro-package that merely matches a keyword is
 * not. Popularity therefore strongly amplifies topical relevance, but only for
 * on-topic candidates — it can never rescue an off-topic result (FR-007).
 */
export function adoptionSignal(identity: CandidateIdentity): number {
  const stars = Math.max(0, ...identity.leads.map((lead) => lead.metadata?.stars ?? 0));
  const downloads = Math.max(0, ...identity.leads.map((lead) => lead.metadata?.downloads ?? 0));
  // Downloads are far more plentiful than stars; scale them down before combining.
  return stars + downloads / 500;
}

/**
 * Relevance ranking (FR-007). Topical match is a gate: off-topic candidates
 * (match 0) score 0 and can never appear, so a huge unrelated repo is excluded.
 * Among on-topic candidates, adoption dominates the ordering — an adopter wants
 * the credible, widely used project, not a keyword-named micro-package that
 * happens to contain the search words. Match strength and cross-source
 * corroboration act as mild tie-breakers between comparably adopted projects.
 */
export function scoreRelevance(identity: CandidateIdentity, terms: IntentTerms): number {
  const match = topicalMatch(identity, terms);
  if (match === 0) return 0;

  const corroboration = 1 + Math.min(identity.leads.length - 1, 3) * 0.05;
  // +10 floor keeps zero-adoption but on-topic leads above true noise while
  // ensuring any real adoption decisively outranks them.
  return (adoptionSignal(identity) + 10) * (1 + match * 0.05) * corroboration;
}
