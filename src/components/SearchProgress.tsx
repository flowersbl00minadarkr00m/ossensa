import type { DiscoveryPhase, DiscoveryProgress } from '../lib/discovery/types';

const PHASE_LABEL: Record<DiscoveryPhase, string> = {
  expanding: 'Expanding your search terms',
  discovering: 'Searching the public web',
  resolving: 'Resolving project identities',
  evidence: 'Retrieving evidence',
  ranking: 'Ranking against your constraints',
  done: 'Done',
};

const STATUS_ICON: Record<string, string> = {
  ok: '✓',
  empty: '·',
  'rate-limited': '⏳',
  failed: '✕',
  timeout: '✕',
  skipped: '–',
  unavailable: '–',
};

interface SearchProgressProps {
  progress: DiscoveryProgress;
}

/** Live discovery progress: phase + per-source status (US-003, NFR-003). */
export function SearchProgress({ progress }: SearchProgressProps) {
  return (
    <div className="search-progress" role="status" aria-live="polite">
      <div className="search-progress-phase">
        {progress.phase !== 'done' && <span className="spinner spinner-sm" aria-hidden="true" />}
        <span>{PHASE_LABEL[progress.phase]}…</span>
      </div>
      <ul className="search-progress-sources" aria-label="Source status">
        {progress.sources.map((source) => (
          <li key={source.sourceId} className={`source-chip source-${source.status}`}>
            <span aria-hidden="true">{STATUS_ICON[source.status] ?? '·'}</span>
            {source.label}
            {source.status === 'ok' && source.leadCount > 0 && (
              <span className="source-count">{source.leadCount}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
