import type { Candidate, CandidateComparison } from '../domain/types';

interface CandidateCardProps {
  candidate: Candidate;
  comparison: CandidateComparison;
  index: number;
  active: boolean;
  selected: boolean;
  compareDisabled: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
}

const VERDICT_LABEL = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  uncertain: 'Uncertain',
  poor: 'Poor fit',
} as const;

export function CandidateCard({
  candidate,
  comparison,
  index,
  active,
  selected,
  compareDisabled,
  onSelect,
  onToggleSelect,
}: CandidateCardProps) {
  const releaseDate = new Date(candidate.lastRelease).toLocaleDateString('en-CA', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className={`candidate-card${active ? ' active' : ''}`}>
      <button className="candidate-select" onClick={onSelect} type="button" aria-pressed={active}>
        <span className="candidate-rank">{index + 1}</span>
        <span className="candidate-main">
          <span className="candidate-top-row">
            <span>
              <strong className="candidate-name">{candidate.name}</strong>
              <span className="candidate-subtitle">{candidate.description}</span>
            </span>
            <span className={`verdict-chip verdict-${comparison.fitVerdict}`}>
              {VERDICT_LABEL[comparison.fitVerdict]}
            </span>
          </span>
          <span className="candidate-meta">
            <span>{candidate.language}</span>
            <span>{candidate.license}</span>
            <span>Updated {releaseDate}</span>
            <span>★ {candidate.stars.toLocaleString()}</span>
          </span>
        </span>
      </button>
      <label className="compare-checkbox">
        <input
          type="checkbox"
          checked={selected}
          disabled={compareDisabled && !selected}
          onChange={onToggleSelect}
        />
        Compare
      </label>
    </article>
  );
}
