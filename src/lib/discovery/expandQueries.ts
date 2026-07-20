import type { Constraint, SearchQuery } from '../../domain/types';

const MAX_QUERIES = 6;

/** Category expansions keyed by trigger patterns over the user's wording. */
const CATEGORY_EXPANSIONS: Array<{ pattern: RegExp; expansions: string[] }> = [
  { pattern: /(home|house|appliance|smart[- ]?home|iot)/, expansions: ['home automation', 'smart home platform'] },
  { pattern: /(workflow|process|business).*(automat|orchestrat)|automat.*(workflow|process)/, expansions: ['workflow automation', 'workflow orchestration'] },
  { pattern: /(password|credential|secret).*(manage|vault|store)/, expansions: ['password manager', 'secrets management'] },
  { pattern: /(note|knowledge|wiki|pkm|second brain)/, expansions: ['note taking', 'knowledge management'] },
  { pattern: /(photo|image).*(backup|library|gallery)/, expansions: ['photo management', 'self-hosted photo library'] },
  { pattern: /(dashboard|visualiz|chart|analytics|bi\b)/, expansions: ['data visualization', 'business intelligence dashboard'] },
  { pattern: /(monitor|observab|metric|logging|alert)/, expansions: ['monitoring', 'observability platform'] },
  { pattern: /(video).*(edit|cut)/, expansions: ['video editor', 'video editing'] },
  { pattern: /(finance|budget|money|expense)/, expansions: ['personal finance', 'budgeting'] },
  { pattern: /(file|document).*(sync|share|storage)|cloud storage/, expansions: ['file sync', 'file sharing server'] },
  { pattern: /(security|intrusion|threat|network).*(detect|monitor)/, expansions: ['network security monitoring', 'intrusion detection'] },
  { pattern: /(vector|embedding|rag|semantic search)/, expansions: ['vector database', 'semantic search engine'] },
  { pattern: /(chat|messag).*(team|server|self)/, expansions: ['team chat server', 'messaging platform'] },
  { pattern: /(crm|customer relation)/, expansions: ['CRM', 'customer relationship management'] },
  { pattern: /(mail|email).*(server|client|host)/, expansions: ['mail server', 'email client'] },
  { pattern: /(media|movie|tv|music).*(server|stream|library)/, expansions: ['media server', 'media streaming'] },
];

const STOP_WORDS = new Set([
  'with', 'that', 'this', 'from', 'into', 'need', 'want', 'looking', 'for',
  'open', 'source', 'software', 'tool', 'tools', 'should', 'could', 'would',
  'the', 'and', 'can', 'able', 'something', 'app', 'application', 'program',
  'find', 'help', 'like', 'best', 'good', 'free', 'own', 'use', 'using',
]);

/**
 * Common but low-salience words. They are meaningful enough to survive the
 * stopword filter, yet generic across most intents, so when the meaningful-word
 * count exceeds the query cap we keep the *distinctive* (domain-specific) words
 * first and let these fill any remaining slots. This stops a long intent from
 * truncating a rare, defining term ("...like calibre") in favor of filler.
 */
const COMMON_WORDS = new Set([
  'data', 'system', 'systems', 'server', 'servers', 'service', 'services',
  'platform', 'manage', 'manager', 'management', 'web', 'local', 'self',
  'hosted', 'host', 'online', 'simple', 'small', 'support', 'based', 'user',
  'users', 'multiple', 'automatic', 'solution', 'project', 'library',
]);

/** Strip request framing so only the job description remains. */
export function cleanIntent(naturalLanguage: string): string {
  return naturalLanguage
    .replace(/\b(i need|i'm looking for|im looking for|find me|search for|what is|show me|i want|help me)\b/gi, '')
    .replace(/[^a-zA-Z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Meaningful keywords from the intent, capped for query use. When more
 * meaningful words are present than the cap allows, distinctive
 * (non-common) words are kept ahead of common filler so a defining late
 * term survives truncation. Order is otherwise preserved and the result is
 * deterministic. Below the cap, the original order is returned unchanged.
 */
export function extractKeywords(intent: string, cap = 5): string[] {
  const words = intent
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  if (words.length <= cap) return words;
  const distinctive = words.filter((word) => !COMMON_WORDS.has(word));
  const common = words.filter((word) => COMMON_WORDS.has(word));
  return [...distinctive, ...common].slice(0, cap);
}

export interface ExpandedQueries {
  /** The user's original wording, cleaned — always first for traceability. */
  original: string;
  /** Bounded query set covering category names, synonyms, and constraints. */
  queries: string[];
}

/**
 * Deterministic query expansion (FR-002). No AI required; AI-proposed queries
 * may be appended by the orchestrator, labeled as such.
 */
export function expandQueries(query: SearchQuery): ExpandedQueries {
  const original = cleanIntent(query.naturalLanguage);
  const lower = original.toLowerCase();
  const queries: string[] = [];

  const keywords = extractKeywords(lower).join(' ');
  if (keywords) queries.push(keywords);

  for (const { pattern, expansions } of CATEGORY_EXPANSIONS) {
    if (pattern.test(lower)) queries.push(...expansions);
  }

  // Required constraints contribute their own keyword queries
  const requiredConstraints = query.constraints.filter(
    (c: Constraint) => c.category === 'required',
  );
  for (const constraint of requiredConstraints) {
    const constraintKeywords = extractKeywords(cleanIntent(constraint.text).toLowerCase(), 4).join(' ');
    if (constraintKeywords && constraintKeywords !== keywords) queries.push(constraintKeywords);
  }

  const deduped = [...new Set(queries.filter(Boolean))].slice(0, MAX_QUERIES);
  return { original, queries: deduped };
}
