import type { Candidate, CandidateComparison } from '../domain/types';

interface Props {
  candidates: Candidate[];
  comparisons: CandidateComparison[];
}

const VERDICT_LABEL = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  uncertain: 'Uncertain',
  poor: 'Poor fit',
};

function FreshnessDate({ iso }: { iso: string }) {
  const date = new Date(iso);
  const age = Date.now() - date.getTime();
  const days = Math.floor(age / (1000 * 60 * 60 * 24));
  const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const stale = days > 30;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {label}
      {stale && <span className="badge badge-not-acceptable" style={{ fontSize: 10 }}>Stale</span>}
    </span>
  );
}

export function ComparisonTable({ candidates, comparisons }: Props) {
  const pairs = candidates.map((c) => ({
    candidate: c,
    comp: comparisons.find((cp) => cp.candidateId === c.id),
  })).filter((p) => p.comp) as Array<{ candidate: Candidate; comp: CandidateComparison }>;

  if (pairs.length === 0) return null;

  const FIELDS = [
    'Summary',
    'Fit verdict',
    'Covers',
    'Gaps',
    'Setup effort',
    'Ongoing responsibility',
    'Evidence freshness',
    'Unknowns',
    'Advantages',
    'Disadvantages',
  ];

  function renderCell(field: string, candidate: Candidate, comp: CandidateComparison) {
    switch (field) {
      case 'Summary':
        return (
          <span>
            {comp.laymanSummary}
            {comp.aiAugmented && <span className="ai-badge" style={{ marginLeft: 6 }}>AI</span>}
          </span>
        );
      case 'Fit verdict':
        return (
          <span className={`verdict-chip verdict-${comp.fitVerdict}`}>
            {VERDICT_LABEL[comp.fitVerdict]}
          </span>
        );
      case 'Covers':
        return (
          <ul className="ct-list">
            {candidate.constraintCoverage.required.met.map((c) => (
              <li key={c.id}>✓ {c.text}</li>
            ))}
            {candidate.constraintCoverage.preferred.met.map((c) => (
              <li key={c.id} style={{ color: 'var(--text-muted)' }}>~ {c.text}</li>
            ))}
            {candidate.constraintCoverage.required.met.length === 0 &&
              candidate.constraintCoverage.preferred.met.length === 0 && (
                <li style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>None</li>
              )}
          </ul>
        );
      case 'Gaps':
        return (
          <ul className="ct-list">
            {candidate.constraintCoverage.required.missed.map((c) => (
              <li key={c.id} style={{ color: 'var(--danger)' }}>✗ {c.text}</li>
            ))}
            {candidate.constraintCoverage.preferred.missed.map((c) => (
              <li key={c.id} style={{ color: 'var(--text-muted)' }}>– {c.text}</li>
            ))}
            {candidate.constraintCoverage.required.missed.length === 0 &&
              candidate.constraintCoverage.preferred.missed.length === 0 && (
                <li style={{ color: 'var(--success)', fontStyle: 'italic' }}>None</li>
              )}
          </ul>
        );
      case 'Setup effort':
        return (
          <div>
            <span className={`badge badge-${comp.setupEffort.level === 'low' ? 'preferred' : comp.setupEffort.level === 'medium' ? 'count' : 'not-acceptable'}`}>
              {comp.setupEffort.level.charAt(0).toUpperCase() + comp.setupEffort.level.slice(1)}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              {comp.setupEffort.explanation}
            </p>
          </div>
        );
      case 'Ongoing responsibility':
        return <span style={{ fontSize: 13 }}>{comp.ongoingResponsibility}</span>;
      case 'Evidence freshness':
        return <FreshnessDate iso={comp.evidenceFreshness} />;
      case 'Unknowns':
        return comp.unknowns.length > 0 ? (
          <ul className="ct-list">
            {comp.unknowns.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        ) : (
          <span style={{ color: 'var(--success)', fontSize: 13 }}>None identified</span>
        );
      case 'Advantages':
        return (
          <table className="adv-table">
            <tbody>
              {comp.advantages.map((a, i) => (
                <tr key={i}>
                  <td className="adv-icon" aria-label="Advantage">+</td>
                  <td>{a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'Disadvantages':
        return (
          <table className="adv-table">
            <tbody>
              {comp.disadvantages.map((d, i) => (
                <tr key={i}>
                  <td className="adv-icon disadv" aria-label="Disadvantage">−</td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  }

  return (
    <div className="comparison-table-wrap">
      <div className="comparison-table-scroll">
        <table className="comparison-table">
          <colgroup>
            <col style={{ width: '160px' }} />
            {pairs.map((_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" />
              {pairs.map(({ candidate }) => (
                <th key={candidate.id} scope="col">
                  <a href={candidate.repoUrl} target="_blank" rel="noreferrer" className="ct-repo-link">
                    {candidate.name} ↗
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((field) => (
              <tr key={field}>
                <th scope="row" className="ct-field-label">{field}</th>
                {pairs.map(({ candidate, comp }) => (
                  <td key={candidate.id} className="ct-cell">
                    {renderCell(field, candidate, comp)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .comparison-table-wrap { overflow: hidden; }
        .comparison-table-scroll { overflow-x: auto; }
        .comparison-table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
          min-width: 500px;
        }
        .comparison-table th,
        .comparison-table td {
          padding: 10px 12px;
          border: 1px solid var(--border-light);
          text-align: left;
          vertical-align: top;
          min-width: 0;
          overflow: hidden;
        }
        .comparison-table thead th {
          background: var(--surface-2);
          font-size: 13px;
          font-weight: 600;
          position: sticky;
          top: 0;
        }
        .ct-field-label {
          background: var(--surface-2);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
          width: 160px;
        }
        .ct-cell { font-size: 13px; color: var(--text); }
        .ct-list {
          margin: 0;
          padding: 0 0 0 14px;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ct-repo-link {
          color: var(--accent);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }
        .ct-repo-link:hover { text-decoration: underline; }
        .adv-table { border-collapse: collapse; width: 100%; }
        .adv-table td { padding: 2px 4px; font-size: 13px; vertical-align: top; border: none; }
        .adv-icon {
          color: var(--success);
          font-weight: 700;
          width: 18px;
          text-align: center;
          flex-shrink: 0;
        }
        .adv-icon.disadv { color: var(--danger); }
      `}</style>
    </div>
  );
}
