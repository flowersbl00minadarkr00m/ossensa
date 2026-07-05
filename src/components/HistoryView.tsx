import type { SearchHistory, Constraint } from '../domain/types';
import { isEvidenceStale, queriesOverlap } from '../domain/history';

interface Props {
  history: SearchHistory[];
  currentQuery?: string;
  onReopen: (entry: SearchHistory) => void;
}

export function HistoryView({ history, currentQuery, onReopen }: Props) {
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h3>No search history yet</h3>
        <p>Run a search and record decisions — they'll appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Search History</h2>
      </div>

      {history.map((entry) => {
        const allEvidence = entry.candidates.flatMap((c) => c.evidence);
        const stale = allEvidence.some((e) => isEvidenceStale(e.retrievedAt));
        const overlap = currentQuery ? queriesOverlap(currentQuery, entry.query.naturalLanguage) : false;
        const decision = entry.decisions[0];
        const date = new Date(entry.searchedAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        });

        return (
          <div key={entry.id} className="card" style={{ marginBottom: 10 }}>
            {overlap && (
              <div className="alert alert-info" style={{ marginBottom: 12 }}>
                Similar to your current search — review this decision before proceeding.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>{date}</p>
                <p style={{ margin: '4px 0 6px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  "{entry.query.naturalLanguage.length > 80
                    ? entry.query.naturalLanguage.slice(0, 80) + '…'
                    : entry.query.naturalLanguage}"
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="badge badge-count">{entry.candidates.length} result{entry.candidates.length !== 1 ? 's' : ''}</span>
                  {entry.candidates.slice(0, 3).map((c) => (
                    <span key={c.id} className="badge badge-count">{c.name}</span>
                  ))}
                  {stale && <span className="badge badge-not-acceptable">⚠ Stale evidence</span>}
                </div>
                {decision && (
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    Decision: <strong>{decision.action}</strong>
                    {decision.rationale && ` — "${decision.rationale.slice(0, 60)}${decision.rationale.length > 60 ? '…' : ''}"`}
                  </div>
                )}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onReopen(entry)}
                type="button"
                style={{ flexShrink: 0 }}
              >
                Re-open
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Constraints
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {entry.query.constraints.map((c: Constraint) => (
                  <span
                    key={c.id}
                    className={`badge badge-${c.category === 'required' ? 'required' : c.category === 'preferred' ? 'preferred' : 'not-acceptable'}`}
                  >
                    {c.text.length > 40 ? c.text.slice(0, 40) + '…' : c.text}
                  </span>
                ))}
                {entry.query.constraints.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>No constraints</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
