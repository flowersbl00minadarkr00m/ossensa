import { useState } from 'react';
import type { Constraint } from '../domain/types';
import { GlossaryTooltip } from './GlossaryTooltip';
import { GLOSSARY } from '../lib/glossary';

interface Props {
  constraints: Constraint[];
  onChange: (constraints: Constraint[]) => void;
  onRerun: () => void;
  loading?: boolean;
}

type Category = Constraint['category'];

const SECTION_META: Record<Category, { label: string; effect: string; badgeClass: string }> = {
  required: {
    label: 'Required',
    effect: 'Candidates that don\'t meet these are excluded from results',
    badgeClass: 'badge-required',
  },
  preferred: {
    label: 'Preferred',
    effect: 'Candidates that meet these are ranked higher',
    badgeClass: 'badge-preferred',
  },
  'not-acceptable': {
    label: 'Not Acceptable',
    effect: 'Any candidate with these traits is excluded',
    badgeClass: 'badge-not-acceptable',
  },
};

const CATEGORIES: Category[] = ['required', 'preferred', 'not-acceptable'];

function newId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Wrap known glossary terms in GlossaryTooltip chips */
function AnnotatedText({ text }: { text: string }) {
  const terms = Object.keys(GLOSSARY);
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const found = terms
      .map((t) => ({ term: t, idx: remaining.toLowerCase().indexOf(t.toLowerCase()) }))
      .filter((m) => m.idx >= 0)
      .sort((a, b) => a.idx - b.idx)[0];

    if (!found || found.idx === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (found.idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, found.idx)}</span>);
    }

    parts.push(
      <GlossaryTooltip key={key++} term={found.term}>
        {remaining.slice(found.idx, found.idx + found.term.length)}
      </GlossaryTooltip>,
    );

    remaining = remaining.slice(found.idx + found.term.length);
  }

  return <>{parts}</>;
}

function ConstraintRow({
  constraint,
  onEdit,
  onDelete,
  onReclassify,
}: {
  constraint: Constraint;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onReclassify: (cat: Category) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(constraint.text);
  const [showReclassify, setShowReclassify] = useState(false);
  const meta = SECTION_META[constraint.category];

  function saveEdit() {
    const trimmed = draft.trim();
    if (trimmed) onEdit(trimmed);
    else setDraft(constraint.text);
    setEditing(false);
  }

  return (
    <div className="constraint-row">
      <span className={`badge ${meta.badgeClass}`} style={{ flexShrink: 0 }}>
        {meta.label}
      </span>

      {editing ? (
        <input
          className="form-input"
          style={{ flex: 1, fontSize: 13, padding: '4px 8px' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { setDraft(constraint.text); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span className="constraint-text" onClick={() => setEditing(true)}>
          <AnnotatedText text={constraint.text} />
        </span>
      )}

      <div style={{ display: 'flex', gap: 4, flexShrink: 0, position: 'relative' }}>
        <button
          className="btn-icon"
          title="Edit"
          aria-label="Edit constraint"
          onClick={() => setEditing(true)}
          type="button"
        >
          ✏️
        </button>
        <button
          className="btn-icon"
          title="Reclassify"
          aria-label="Reclassify constraint"
          onClick={() => setShowReclassify((v) => !v)}
          type="button"
        >
          ⇄
        </button>
        <button
          className="btn-icon"
          title="Delete"
          aria-label="Delete constraint"
          onClick={onDelete}
          type="button"
          style={{ color: 'var(--danger)' }}
        >
          ×
        </button>

        {showReclassify && (
          <div className="reclassify-dropdown">
            {CATEGORIES.filter((c) => c !== constraint.category).map((cat) => (
              <button
                key={cat}
                className="reclassify-option"
                onClick={() => { onReclassify(cat); setShowReclassify(false); }}
                type="button"
              >
                Move to <span className={`badge ${SECTION_META[cat].badgeClass}`}>{SECTION_META[cat].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConstraintEditor({ constraints, onChange, onRerun, loading }: Props) {
  function add(category: Category) {
    onChange([
      ...constraints,
      { id: newId(), text: 'New constraint', category, createdAt: new Date().toISOString() },
    ]);
  }

  function remove(id: string) {
    onChange(constraints.filter((c) => c.id !== id));
  }

  function edit(id: string, text: string) {
    onChange(constraints.map((c) => (c.id === id ? { ...c, text } : c)));
  }

  function reclassify(id: string, category: Category) {
    onChange(constraints.map((c) => (c.id === id ? { ...c, category } : c)));
  }

  return (
    <div className="constraint-editor">
      <div className="section-header">
        <h2 className="section-title">Constraints</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={onRerun}
          disabled={loading || constraints.length === 0}
          type="button"
        >
          {loading ? (
            <><span className="spinner" style={{ width: 12, height: 12 }} /> Running…</>
          ) : (
            '▶ Re-run Search'
          )}
        </button>
      </div>

      {CATEGORIES.map((cat) => {
        const items = constraints.filter((c) => c.category === cat);
        const meta = SECTION_META[cat];
        return (
          <div key={cat} className="constraint-section">
            <div className="constraint-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                <span className="badge badge-count">{items.length}</span>
              </div>
              <span className="constraint-effect">{meta.effect}</span>
            </div>
            <div className="constraint-list" role="list">
              {items.map((c) => (
                <div key={c.id} role="listitem">
                  <ConstraintRow
                    constraint={c}
                    onEdit={(text) => edit(c.id, text)}
                    onDelete={() => remove(c.id)}
                    onReclassify={(newCat) => reclassify(c.id, newCat)}
                  />
                </div>
              ))}
              {items.length === 0 && (
                <div className="constraint-empty">None yet</div>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => add(cat)}
              type="button"
              style={{ marginTop: 4 }}
            >
              + Add constraint
            </button>
          </div>
        );
      })}

      <style>{`
        .constraint-editor {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          margin-bottom: 24px;
        }
        .constraint-section {
          border-top: 1px solid var(--border-light);
          padding-top: 14px;
          margin-top: 14px;
        }
        .constraint-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .constraint-effect {
          font-size: 12px;
          color: var(--text-dim);
          font-style: italic;
        }
        .constraint-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .constraint-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          background: var(--surface-2);
          border: 1px solid var(--border-light);
          border-radius: var(--radius);
          min-width: 0;
        }
        .constraint-text {
          flex: 1;
          font-size: 13px;
          color: var(--text);
          cursor: pointer;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .constraint-text:hover {
          color: var(--accent);
        }
        .constraint-empty {
          font-size: 13px;
          color: var(--text-dim);
          padding: 6px 10px;
          font-style: italic;
        }
        .reclassify-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          z-index: 50;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 180px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .reclassify-option {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          padding: 6px 10px;
          text-align: left;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text);
        }
        .reclassify-option:hover {
          background: var(--surface-2);
        }
      `}</style>
    </div>
  );
}
