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

export function ComparisonCards({ candidates, comparisons }: Props) {
  const pairs = candidates.map((c) => ({
    candidate: c,
    comp: comparisons.find((cp) => cp.candidateId === c.id),
  })).filter((p) => p.comp) as Array<{ candidate: Candidate; comp: CandidateComparison }>;

  if (pairs.length === 0) return null;

  return (
    <div className="cc-wrap">
      {pairs.map(({ candidate, comp }) => (
        <div key={candidate.id} className="cc-card">
          <h3 className="cc-name">
            <a href={candidate.repoUrl} target="_blank" rel="noreferrer">{candidate.name} ↗</a>
          </h3>

          <dl className="cc-dl">
            <dt>Summary</dt>
            <dd>
              {comp.laymanSummary}
              {comp.aiAugmented && <span className="ai-badge" style={{ marginLeft: 6 }}>AI</span>}
            </dd>

            <dt>Fit verdict</dt>
            <dd>
              <span className={`verdict-chip verdict-${comp.fitVerdict}`}>
                {VERDICT_LABEL[comp.fitVerdict]}
              </span>
            </dd>

            <dt>Covers</dt>
            <dd>
              {candidate.constraintCoverage.required.met.length === 0 &&
               candidate.constraintCoverage.preferred.met.length === 0 ? (
                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>None</span>
              ) : (
                <ul className="cc-list">
                  {candidate.constraintCoverage.required.met.map((c) => (
                    <li key={c.id}>✓ {c.text}</li>
                  ))}
                  {candidate.constraintCoverage.preferred.met.map((c) => (
                    <li key={c.id} style={{ color: 'var(--text-muted)' }}>~ {c.text}</li>
                  ))}
                </ul>
              )}
            </dd>

            <dt>Gaps</dt>
            <dd>
              {candidate.constraintCoverage.required.missed.length === 0 &&
               candidate.constraintCoverage.preferred.missed.length === 0 ? (
                <span style={{ color: 'var(--success)', fontStyle: 'italic' }}>None</span>
              ) : (
                <ul className="cc-list">
                  {candidate.constraintCoverage.required.missed.map((c) => (
                    <li key={c.id} style={{ color: 'var(--danger)' }}>✗ {c.text}</li>
                  ))}
                  {candidate.constraintCoverage.preferred.missed.map((c) => (
                    <li key={c.id} style={{ color: 'var(--text-muted)' }}>– {c.text}</li>
                  ))}
                </ul>
              )}
            </dd>

            <dt>Setup effort</dt>
            <dd>
              <span className={`badge badge-${comp.setupEffort.level === 'low' ? 'preferred' : comp.setupEffort.level === 'medium' ? 'count' : 'not-acceptable'}`}>
                {comp.setupEffort.level.charAt(0).toUpperCase() + comp.setupEffort.level.slice(1)}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {comp.setupEffort.explanation}
              </p>
            </dd>

            <dt>Ongoing responsibility</dt>
            <dd>{comp.ongoingResponsibility}</dd>

            <dt>Evidence freshness</dt>
            <dd>{new Date(comp.evidenceFreshness).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>

            <dt>Unknowns</dt>
            <dd>
              {comp.unknowns.length === 0 ? (
                <span style={{ color: 'var(--success)', fontStyle: 'italic' }}>None identified</span>
              ) : (
                <ul className="cc-list">
                  {comp.unknowns.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              )}
            </dd>

            {comp.advantages.map((a, i) => (
              <>
                <dt key={`adt-${i}`} className="cc-advantage-dt">Advantage +</dt>
                <dd key={`add-${i}`} className="cc-advantage-dd">{a}</dd>
              </>
            ))}

            {comp.disadvantages.map((d, i) => (
              <>
                <dt key={`ddt-${i}`} className="cc-disadvantage-dt">Disadvantage −</dt>
                <dd key={`ddd-${i}`} className="cc-disadvantage-dd">{d}</dd>
              </>
            ))}
          </dl>
        </div>
      ))}

      <style>{`
        .cc-wrap { display: flex; flex-direction: column; gap: 16px; }
        .cc-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          min-width: 0;
        }
        .cc-name { margin: 0 0 12px; font-size: 16px; }
        .cc-name a { color: var(--accent); text-decoration: none; }
        .cc-name a:hover { text-decoration: underline; }
        .cc-dl {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 4px 12px;
          margin: 0;
          min-width: 0;
        }
        .cc-dl dt {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding-top: 6px;
          white-space: nowrap;
        }
        .cc-dl dd {
          font-size: 13px;
          color: var(--text);
          margin: 0;
          padding-top: 6px;
          min-width: 0;
          overflow: hidden;
        }
        .cc-list {
          margin: 0;
          padding: 0 0 0 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 13px;
        }
        .cc-advantage-dt { color: var(--success) !important; }
        .cc-advantage-dd { color: var(--text); }
        .cc-disadvantage-dt { color: var(--danger) !important; }
        .cc-disadvantage-dd { color: var(--text); }
        @media (max-width: 360px) {
          .cc-dl { grid-template-columns: 1fr; }
          .cc-dl dt { padding-top: 10px; }
        }
      `}</style>
    </div>
  );
}
