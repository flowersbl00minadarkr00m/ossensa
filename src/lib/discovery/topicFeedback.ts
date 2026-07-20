import type { CandidateIdentity } from './types';
import type { IntentTerms } from './relevance';

/**
 * Pseudo-relevance feedback (recall idea 003 #1).
 *
 * The hardcoded category table in expandQueries only covers ~17 domains; any
 * intent outside them gets a single keyword query, which is the pipeline's
 * biggest recall limiter. But GitHub leads already carry `metadata.topics`.
 * After the first pass, we take the topics that the *on-topic* candidates
 * actually share and turn the most corroborated ones into follow-up queries —
 * generalizing the category table deterministically, with no AI, and without
 * rescuing off-topic noise (only relevance>0 identities are fed in).
 */

const MIN_TOPIC_WORD = 3;

function topicWords(topic: string): string[] {
  return topic.split(/[-_\s]+/).filter((w) => w.length >= MIN_TOPIC_WORD);
}

/** A topic is worth querying only if it introduces a word the intent lacks. */
function addsSignal(topic: string, covered: Set<string>): boolean {
  const words = topicWords(topic);
  if (words.length === 0) return false;
  return words.some((w) => !covered.has(w));
}

/**
 * @param onTopicIdentities identities already filtered to relevance>0, most
 *   relevant first (the caller passes a bounded slice).
 * @param existingTerms the intent terms already searched.
 * @param max cap on follow-up queries (bounds cost).
 * @returns deterministic follow-up query strings, e.g. "home automation".
 */
export function deriveTopicFeedbackQueries(
  onTopicIdentities: CandidateIdentity[],
  existingTerms: IntentTerms,
  max = 2,
): string[] {
  // Count each topic once per identity so a single multi-lead repo cannot
  // dominate the feedback.
  const counts = new Map<string, number>();
  for (const identity of onTopicIdentities) {
    const seen = new Set<string>();
    for (const lead of identity.leads) {
      for (const raw of lead.metadata?.topics ?? []) {
        const topic = raw.toLowerCase().trim();
        if (topic) seen.add(topic);
      }
    }
    for (const topic of seen) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  const covered = new Set<string>();
  for (const word of existingTerms.words) covered.add(word);
  for (const phrase of existingTerms.phrases) {
    for (const word of phrase.split(/\s+/)) if (word) covered.add(word);
  }

  return [...counts.entries()]
    // Corroboration: a topic must be shared by >=2 on-topic candidates to count
    // as feedback rather than one project's idiosyncratic tag.
    .filter(([topic, count]) => count >= 2 && addsSignal(topic, covered))
    // Deterministic: most corroborated first, ties broken alphabetically.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([topic]) => topic.replace(/[-_]+/g, ' '));
}
