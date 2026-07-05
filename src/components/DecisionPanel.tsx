import { useState } from 'react';
import type { Candidate, CandidateComparison, Decision, SearchQuery } from '../domain/types';

interface Props {
  candidate: Candidate;
  comparison: CandidateComparison;
  query: SearchQuery;
  existingDecision?: Decision;
  onDecide: (decision: Decision) => void;
}

type Action = Decision['action'];

const ACTIONS: { id: Action; label: string; color: string }[] = [
  { id: 'accepted', label: 'Accept', color: 'var(--success)' },
  { id: 'shortlisted', label: 'Shortlist', color: 'var(--accent)' },
  { id: 'rejected', label: 'Reject', color: 'var(--danger)' },
  { id: 'revisit', label: 'Revisit later', color: 'var(--warning)' },
];

function buildObsidianMarkdown(candidate: Candidate, comparison: CandidateComparison, decision: Decision, query: SearchQuery): string {
  return `---
title: "Decision: ${candidate.name}"
date: ${new Date(decision.decidedAt).toISOString().split('T')[0]}
decision: ${decision.action}
candidate: ${candidate.name}
license: ${candidate.license}
tags: [ossensa, decision, open-source]
---

## Decision

**${candidate.name}** — ${decision.action.charAt(0).toUpperCase() + decision.action.slice(1)}

**Query:** ${query.naturalLanguage}

**Rationale:** ${decision.rationale || 'Not provided'}

## Fit Assessment

- **Verdict:** ${comparison.fitVerdict}
- **Setup effort:** ${comparison.setupEffort.level} — ${comparison.setupEffort.explanation}
- **Ongoing responsibility:** ${comparison.ongoingResponsibility}

## Advantages
${comparison.advantages.map((a) => `- ${a}`).join('\n')}

## Disadvantages
${comparison.disadvantages.map((d) => `- ${d}`).join('\n')}

## Unknowns
${comparison.unknowns.length > 0 ? comparison.unknowns.map((u) => `- ${u}`).join('\n') : '- None identified'}

## Evidence Snapshot
${decision.evidenceSnapshot.map((e) => `- **${e.source}** (${new Date(e.retrievedAt).toLocaleDateString()}): ${e.claim} — [source](${e.sourceUrl})`).join('\n')}
`;
}

function buildSancusSightJSON(candidate: Candidate, decision: Decision): string {
  return JSON.stringify({
    type: 'ossensa-handoff',
    version: '1.0',
    candidate: {
      name: candidate.name,
      repoUrl: candidate.repoUrl,
      license: candidate.license,
      language: candidate.language,
    },
    decision: {
      action: decision.action,
      rationale: decision.rationale,
      decidedAt: decision.decidedAt,
    },
    evidence: decision.evidenceSnapshot,
  }, null, 2);
}

export function DecisionPanel({ candidate, comparison, query, existingDecision, onDecide }: Props) {
  const [action, setAction] = useState<Action | null>(existingDecision?.action ?? null);
  const [rationale, setRationale] = useState(existingDecision?.rationale ?? '');
  const [rationaleError, setRationaleError] = useState('');
  const [exported, setExported] = useState(false);
  const [saved, setSaved] = useState<Decision | null>(existingDecision ?? null);

  function handleSave() {
    if (action === 'rejected' && !rationale.trim()) {
      setRationaleError('Please provide a rationale for rejection.');
      return;
    }
    setRationaleError('');
    const decision: Decision = {
      id: `d-${Date.now()}`,
      candidateId: candidate.id,
      queryId: query.id,
      action: action!,
      rationale: rationale.trim(),
      decidedAt: new Date().toISOString(),
      evidenceSnapshot: candidate.evidence,
    };
    setSaved(decision);
    setExported(false);
    onDecide(decision);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }

  function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="decision-panel">
      <div className="section-header">
        <h3 className="section-title" style={{ fontSize: 14 }}>
          Record decision for <strong>{candidate.name}</strong>
        </h3>
      </div>

      <div className="decision-actions">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            className={`btn btn-secondary btn-sm ${action === a.id ? 'decision-btn-active' : ''}`}
            style={action === a.id ? { borderColor: a.color, color: a.color, background: `${a.color}14` } : {}}
            onClick={() => { setAction(a.id); setRationaleError(''); }}
            type="button"
            aria-pressed={action === a.id}
          >
            {a.label}
          </button>
        ))}
      </div>

      {action && (
        <div className="form-group" style={{ marginTop: 12 }}>
          <label htmlFor={`rationale-${candidate.id}`} className="form-label">
            Rationale {action === 'rejected' ? '(required)' : '(optional)'}
          </label>
          <textarea
            id={`rationale-${candidate.id}`}
            className={`form-textarea${rationaleError ? ' error' : ''}`}
            value={rationale}
            onChange={(e) => { setRationale(e.target.value); setRationaleError(''); }}
            placeholder="Why did you make this decision?"
            rows={3}
          />
          {rationaleError && <p className="form-error">{rationaleError}</p>}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            type="button"
            style={{ alignSelf: 'flex-start', marginTop: 6 }}
          >
            Save decision
          </button>
        </div>
      )}

      {saved && saved.action === 'accepted' && !exported && (
        <div className="decision-exports">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            Decision saved. Export to your tools:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { copyToClipboard(buildSancusSightJSON(candidate, saved)); setExported(true); }}
              type="button"
            >
              Copy SancusSight JSON
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { copyToClipboard(`mnemosync://task?ref=${encodeURIComponent(candidate.name)}&decision=${saved.action}`); }}
              type="button"
            >
              Copy Mnemosync ref
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const filename = `decision-${candidate.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`;
                downloadFile(filename, buildObsidianMarkdown(candidate, comparison, saved, query));
              }}
              type="button"
            >
              Export Obsidian Markdown ↓
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="alert alert-info" style={{ marginTop: 10 }}>
          ✓ Decision recorded: <strong>{saved.action}</strong>
          {saved.rationale && ` — "${saved.rationale.slice(0, 60)}${saved.rationale.length > 60 ? '…' : ''}"`}
        </div>
      )}

      <style>{`
        .decision-panel {
          background: var(--surface-2);
          border: 1px solid var(--border-light);
          border-radius: var(--radius);
          padding: 14px;
          margin-top: 16px;
        }
        .decision-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .decision-exports {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border-light);
        }
      `}</style>
    </div>
  );
}
