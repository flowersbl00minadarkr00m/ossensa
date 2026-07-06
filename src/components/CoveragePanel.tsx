import { useState } from 'react';
import type { SearchCoverage } from '../lib/discovery/types';

const STATUS_LABEL: Record<string, string> = {
  ok: 'Searched',
  empty: 'No matches',
  'rate-limited': 'Rate limited',
  failed: 'Failed',
  timeout: 'Timed out',
  skipped: 'Not searched',
  unavailable: 'Unavailable',
};

interface CoveragePanelProps {
  coverage: SearchCoverage;
  onRetrySource: (sourceId: string) => void;
  retryingSource: string | null;
}

/**
 * Source-coverage summary: what was searched, what failed, what it means
 * (FR-008, US-003). Failed sources are individually retryable.
 */
export function CoveragePanel({ coverage, onRetrySource, retryingSource }: CoveragePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const searched = coverage.sources.filter((s) => s.status === 'ok' || s.status === 'empty').length;
  const problems = coverage.sources.filter((s) => s.retryable && s.status !== 'ok' && s.status !== 'empty');
  const durationS = (coverage.spent.ms / 1000).toFixed(1);

  return (
    <section className="coverage-panel" aria-label="Search coverage">
      <button
        className="coverage-summary"
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>
          Coverage: {searched} of {coverage.sources.length} sources searched in {durationS}s
          {problems.length > 0 && (
            <span className="coverage-warning"> · {problems.length} source{problems.length === 1 ? '' : 's'} incomplete</span>
          )}
        </span>
        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="coverage-detail">
          <ul className="coverage-sources">
            {coverage.sources.map((source) => (
              <li key={source.sourceId} className={`coverage-source coverage-${source.status}`}>
                <span className="coverage-source-name">{source.label}</span>
                <span className="coverage-source-status">
                  {STATUS_LABEL[source.status] ?? source.status}
                  {source.leadCount > 0 && ` · ${source.leadCount} lead${source.leadCount === 1 ? '' : 's'}`}
                  {source.detail ? ` — ${source.detail}` : ''}
                </span>
                {source.retryable && source.status !== 'ok' && source.status !== 'empty' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={retryingSource !== null}
                    onClick={() => onRetrySource(source.sourceId)}
                  >
                    {retryingSource === source.sourceId ? 'Retrying…' : 'Retry'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {coverage.gaps.length > 0 && (
            <div className="coverage-gaps">
              <strong>What this means for confidence:</strong>
              <ul>
                {coverage.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
