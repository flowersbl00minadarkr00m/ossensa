import type { Candidate, CandidateComparison } from '../domain/types';
import { ComparisonTable } from './ComparisonTable';
import { ComparisonCards } from './ComparisonCards';
import { useMediaQuery } from '../lib/useMediaQuery';

interface Props {
  candidate: Candidate;
  comparison: CandidateComparison;
  index: number;
  isCapped: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

const VERDICT_LABEL = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  uncertain: 'Uncertain',
  poor: 'Poor fit',
};

const VERDICT_ICON = {
  strong: '✓',
  partial: '~',
  uncertain: '?',
  poor: '✗',
};

export function CandidateCard({
  candidate,
  comparison,
  index,
  selected,
  onToggleSelect,
}: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [expanded, setExpanded] = useState(false);

  const verdictClass = `verdict-${comparison.fitVerdict}`;
  const releaseDate = candidate.lastRelease
    ? new Date(candidate.lastRelease).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : 'Unknown';

  return (
    <div className={`candidate-card ${expanded ? 'expanded' : ''}`}>
      <div className="candidate-header" onClick={() => setExpanded((v) => !v)}>
        <div className="candidate-rank">{index + 1}</div>

        <div className="candidate-main">
          <div className="candidate-top-row">
            <span className="candidate-name">{candidate.name}</span>
            <span className={`verdict-chip ${verdictClass}`}>
              <span aria-hidden="true">{VERDICT_ICON[comparison.fitVerdict]}</span>
              {VERDICT_LABEL[comparison.fitVerdict]}
            </span>
          </div>
          <p className="candidate-desc">{candidate.description}</p>
          <div className="candidate-meta">
            <span className="meta-item">{candidate.language}</span>
            <span className="meta-sep">·</span>
            <span className="meta-item">{candidate.license}</span>
            <span className="meta-sep">·</span>
            <span className="meta-item">Updated {releaseDate}</span>
            <span className="meta-sep">·</span>
            <span className="meta-item">⭐ {candidate.stars.toLocaleString()}</span>
          </div>
        </div>

        <div className="candidate-actions" onClick={(e) => e.stopPropagation()}>
          <label className="compare-checkbox">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Compare ${candidate.name}`}
            />
            <span>Compare</span>
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            type="button"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="candidate-detail">
          <hr className="divider" style={{ margin: '12px 0' }} />
          {isMobile ? (
            <ComparisonCards comparisons={[comparison]} candidates={[candidate]} />
          ) : (
            <ComparisonTable comparisons={[comparison]} candidates={[candidate]} />
          )}
        </div>
      )}

      <style>{`
        .candidate-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: border-color 0.15s;
          min-width: 0;
        }
        .candidate-card + .candidate-card { margin-top: 10px; }
        .candidate-card.expanded { border-color: var(--accent); }
        .candidate-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          cursor: pointer;
        }
        .candidate-header:hover { background: var(--surface-2); }
        .candidate-rank {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .candidate-main { flex: 1; min-width: 0; }
        .candidate-top-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .candidate-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
        }
        .candidate-desc {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .candidate-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
          font-size: 12px;
          color: var(--text-dim);
        }
        .meta-item {}
        .meta-sep { color: var(--border); }
        .candidate-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }
        .compare-checkbox {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
        }
        .candidate-detail {
          padding: 0 20px 20px;
        }
        @media (max-width: 480px) {
          .candidate-header { padding: 12px 14px; gap: 10px; }
          .candidate-actions { flex-direction: row; align-items: center; }
        }
      `}</style>
    </div>
  );
}

// useState import
import { useState } from 'react';
