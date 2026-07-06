import type { Candidate, CandidateComparison, Decision, SearchQuery } from '../domain/types';
import { DecisionPanel } from './DecisionPanel';

interface CandidateDetailProps {
  candidate: Candidate;
  comparison: CandidateComparison;
  query: SearchQuery;
  decision?: Decision;
  onDecide: (decision: Decision) => void;
  onDismiss?: () => void;
  onMarkOfficial?: () => void;
}

const SOURCE_TYPE_LABEL = {
  'retrieved-content': 'retrieved page',
  'structured-metadata': 'API metadata',
  'search-snippet': 'search snippet — unverified',
  'ai-interpretation': 'AI interpretation — unverified',
} as const;

const VERDICT_LABEL = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  uncertain: 'Uncertain',
  poor: 'Poor fit',
} as const;

const LICENSE_LABEL = {
  'osi-open-source': 'OSI open source',
  'source-available': 'Source available',
  proprietary: 'Proprietary',
  unknown: 'Licence unverified',
} as const;

export function CandidateDetail({
  candidate,
  comparison,
  query,
  decision,
  onDecide,
  onDismiss,
  onMarkOfficial,
}: CandidateDetailProps) {
  const requiredMet = candidate.constraintCoverage.required.met;
  const requiredMissed = candidate.constraintCoverage.required.missed;
  const evidenceDate = new Date(comparison.evidenceFreshness).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <aside className="candidate-detail-panel" aria-label={`${candidate.name} details`}>
      <div className="detail-hero">
        <div className="project-mark" aria-hidden="true">
          {candidate.name.split('/').at(-1)?.slice(0, 2).toUpperCase()}
        </div>
        <span className={`verdict-chip verdict-${comparison.fitVerdict}`}>
          {VERDICT_LABEL[comparison.fitVerdict]}
        </span>
        <h2>{candidate.name}</h2>
        <p>{candidate.description || 'No repository description is available.'}</p>
        <a className="btn btn-primary detail-repo-link" href={candidate.repoUrl} target="_blank" rel="noreferrer">
          View repository ↗
        </a>
        {candidate.projectUrl && (
          <a className="btn btn-secondary detail-repo-link" href={candidate.projectUrl} target="_blank" rel="noreferrer">
            Official site ↗
          </a>
        )}
      </div>

      {(candidate.sources?.length || candidate.aliases?.length) && (
        <p className="detail-provenance">
          {candidate.sources && candidate.sources.length > 0 && (
            <>Found via {candidate.sources.join(', ')}. </>
          )}
          {candidate.aliases && candidate.aliases.length > 0 && (
            <>Also known as {candidate.aliases.slice(0, 3).join(', ')}.</>
          )}
        </p>
      )}

      {candidate.conflicts && candidate.conflicts.length > 0 && (
        <div className="detail-conflicts" role="alert">
          <strong>Unresolved conflicts</strong>
          <ul>{candidate.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}</ul>
        </div>
      )}

      <div className="detail-stats" aria-label="Repository facts">
        <div><strong>{candidate.stars.toLocaleString()}</strong><span>Stars</span></div>
        <div><strong>{candidate.language}</strong><span>Primary language</span></div>
        <div><strong>{candidate.license}</strong><span>{LICENSE_LABEL[candidate.licenseClassification ?? 'unknown']}</span></div>
      </div>

      <section className="detail-section">
        <div className="detail-section-heading">
          <h3>Why it fits</h3>
          <span>Evidence checked {evidenceDate}</span>
        </div>
        <p>{comparison.laymanSummary}</p>
        <ul className="detail-check-list">
          {requiredMet.map((constraint) => <li key={constraint.id} className="met">✓ {constraint.text}</li>)}
          {requiredMissed.map((constraint) => <li key={constraint.id} className="missed">! Not confirmed: {constraint.text}</li>)}
          {requiredMet.length === 0 && requiredMissed.length === 0 && (
            <li className="unknown">No explicit required constraints were supplied.</li>
          )}
        </ul>
      </section>

      <section className="detail-section detail-two-column">
        <div>
          <h3>Advantages</h3>
          <ul>{comparison.advantages.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3>Trade-offs</h3>
          <ul>{comparison.disadvantages.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section className="detail-section">
        <h3>What you would own</h3>
        <p>{comparison.ongoingResponsibility}</p>
        <p><strong>{comparison.setupEffort.level} setup effort.</strong> {comparison.setupEffort.explanation}</p>
        {comparison.unknowns.length > 0 && (
          <div className="detail-unknowns">
            <strong>Still unknown</strong>
            <ul>{comparison.unknowns.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3>Evidence trail</h3>
        <ul className="detail-evidence-list">
          {candidate.evidence.slice(0, 10).map((item) => (
            <li key={`${item.claim}-${item.sourceUrl}`}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.claim}</a>
              <span className={`evidence-type evidence-${item.sourceType ?? 'structured-metadata'}`}>
                {SOURCE_TYPE_LABEL[item.sourceType ?? 'structured-metadata']}
                {item.origin === 'user' ? ' · your correction' : ''}
              </span>
            </li>
          ))}
          {candidate.evidence.length === 0 && (
            <li className="unknown">No evidence items were retrieved for this candidate.</li>
          )}
        </ul>
      </section>

      {(onDismiss || onMarkOfficial) && (
        <section className="detail-section detail-corrections" aria-label="Corrections">
          {onMarkOfficial && !candidate.projectUrl && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={onMarkOfficial}>
              Mark repository as official page
            </button>
          )}
          {onDismiss && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onDismiss}>
              Dismiss this result
            </button>
          )}
        </section>
      )}

      <DecisionPanel
        candidate={candidate}
        comparison={comparison}
        query={query}
        existingDecision={decision}
        onDecide={onDecide}
      />
    </aside>
  );
}
