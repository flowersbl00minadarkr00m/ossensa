import { useRef, useState, type FormEvent } from 'react';
import { parseFlowsensaToolingRequirement } from '../domain/flowsensaImport';
import type { SearchQuery } from '../domain/types';

interface Props {
  onSearch: (query: SearchQuery) => void;
  loading?: boolean;
  error?: string | null;
}

export function SearchBar({ onSearch, loading, error }: Props) {
  const [value, setValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSearch({
      id: `q-${Date.now()}`,
      naturalLanguage: value.trim(),
      constraints: [],
      submittedAt: new Date().toISOString(),
      source: 'manual',
    });
  }

  function handleImport() {
    setImportError(null);
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const query = parseFlowsensaToolingRequirement(json);
        setValue(query.naturalLanguage);
        onSearch(query);
      } catch (err) {
        setImportError((err as Error).message ?? 'Invalid Flowsensa JSON');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  }

  return (
    <div className="search-bar-wrap">
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="oss-search-input" className="sr-only">
          Describe what you need
        </label>
        <div className="search-row">
          <input
            ref={inputRef}
            id="oss-search-input"
            className="form-input search-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Describe what you need, e.g. 'self-hosted workflow automation with a REST API'"
            autoFocus
            autoComplete="off"
            aria-label="Describe what you need"
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!value.trim() || loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Searching…
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {(error || importError) && (
          <div className="alert alert-error" style={{ marginTop: 8 }} role="alert">
            {error ?? importError}
          </div>
        )}

        <div className="search-import-row" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleImport}
            disabled={loading}
          >
            Import from Flowsensa
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Choose a Flowsensa tooling-requirement JSON to pre-fill constraints
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFile}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </form>

      <style>{`
        .search-bar-wrap {
          background:
            linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(115deg, rgba(122,77,243,.45), rgba(14,159,143,.28), rgba(201,121,18,.28)) border-box;
          border: 1px solid transparent;
          border-radius: var(--radius-lg);
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 16px 38px rgba(45, 52, 84, 0.09);
        }
        .search-row {
          display: flex;
          gap: 10px;
          align-items: stretch;
          min-width: 0;
        }
        .search-input {
          flex: 1;
          font-size: 15px;
          min-width: 0;
          background: #fbfcff;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border-width: 0;
        }
        @media (max-width: 480px) {
          .search-row {
            flex-direction: column;
          }
          .search-row .btn {
            width: 100%;
            justify-content: center;
          }
        }
        @media (max-width: 600px) {
          .search-bar-wrap .search-import-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
          .search-bar-wrap .search-import-row .btn {
            align-self: stretch;
            justify-content: center;
          }
          .search-bar-wrap .search-import-row span {
            font-size: 11px !important;
            line-height: 1.4;
          }
        }
      `}</style>
    </div>
  );
}
