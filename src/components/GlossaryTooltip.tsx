import { useState, useRef, useId, useEffect } from 'react';
import { GLOSSARY } from '../lib/glossary';

interface Props {
  term: string;
  children?: React.ReactNode;
}

export function GlossaryTooltip({ term, children }: Props) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const definition = GLOSSARY[term];
  if (!definition) return <>{children ?? term}</>;

  function show() { setVisible(true); }
  function hide() { setVisible(false); }
  function toggle() { setVisible((v) => !v); }

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setVisible(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={triggerRef}
        className="glossary-term"
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        type="button"
      >
        {children ?? term}
        <span className="glossary-dot" aria-hidden="true">?</span>
      </button>

      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="glossary-tooltip"
        >
          <strong>{term}</strong>
          <br />
          {definition}
          {/* Touch close button — only visible on touch devices via CSS */}
          <button
            className="glossary-tooltip-close"
            onClick={(e) => { e.stopPropagation(); hide(); }}
            aria-label="Close tooltip"
            type="button"
          >
            ×
          </button>
        </span>
      )}

      <style>{`
        .glossary-term {
          background: none;
          border: none;
          font: inherit;
          color: var(--accent);
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          border-bottom: 1px dashed var(--accent);
          line-height: inherit;
        }
        .glossary-dot {
          font-size: 10px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent-dim);
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
        }
        .glossary-tooltip {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          background: var(--text);
          color: #fff;
          font-size: 13px;
          line-height: 1.5;
          padding: 10px 12px;
          border-radius: var(--radius);
          width: 240px;
          white-space: normal;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        }
        .glossary-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: var(--text);
        }
        .glossary-tooltip-close {
          display: none;
          position: absolute;
          top: 4px;
          right: 6px;
          background: none;
          border: none;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
        }
        @media (hover: none) {
          .glossary-tooltip-close { display: block; }
        }
        @media (max-width: 480px) {
          .glossary-tooltip {
            position: fixed;
            bottom: 24px;
            left: 16px;
            right: 16px;
            transform: none;
            width: auto;
          }
          .glossary-tooltip::after { display: none; }
          .glossary-tooltip-close { display: block; }
        }
      `}</style>
    </span>
  );
}
