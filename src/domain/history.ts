import type { SearchHistory, Decision } from './types';

const HISTORY_KEY = 'ossensa-history';

export function loadHistory(): SearchHistory[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SearchHistory[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: SearchHistory[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function addHistoryEntry(
  history: SearchHistory[],
  entry: SearchHistory,
): SearchHistory[] {
  return [entry, ...history];
}

export function updateDecisionInHistory(
  history: SearchHistory[],
  queryId: string,
  decision: Decision,
): SearchHistory[] {
  return history.map((h) => {
    if (h.query.id !== queryId) return h;
    const existing = h.decisions.findIndex((d) => d.candidateId === decision.candidateId);
    const decisions =
      existing >= 0
        ? h.decisions.map((d, i) => (i === existing ? decision : d))
        : [...h.decisions, decision];
    return { ...h, decisions };
  });
}

/** Evidence older than 30 days is considered stale. */
export function isEvidenceStale(retrievedAt: string): boolean {
  const age = Date.now() - new Date(retrievedAt).getTime();
  return age > 30 * 24 * 60 * 60 * 1000;
}

/** Detect if two queries share ≥2 constraint keyword tokens. */
export function queriesOverlap(queryA: string, queryB: string): boolean {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4);

  const tokensA = new Set(tokenize(queryA));
  const tokensB = tokenize(queryB);
  const overlap = tokensB.filter((t) => tokensA.has(t));
  return overlap.length >= 2;
}
