import { useState } from 'react';
import type { SearchHistory } from '../domain/types';
import { testConnection } from '../lib/openrouterClient';

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

interface Props {
  config: OpenRouterConfig;
  onConfigChange: (c: OpenRouterConfig) => void;
  history: SearchHistory[];
}

const MODELS = [
  'openai/gpt-5.5',
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4-5',
  'google/gemini-2.5-flash',
];

type Tab = 'openrouter' | 'preferences' | 'export' | 'about';

export function SettingsView({ config, onConfigChange, history }: Props) {
  const [tab, setTab] = useState<Tab>('openrouter');
  const [keyDraft, setKeyDraft] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [showContext, setShowContext] = useState(false);

  async function handleTest() {
    if (!keyDraft.trim()) return;
    setTesting(true);
    setTestResult(null);
    const ok = await testConnection({ apiKey: keyDraft, model: config.model });
    setTestResult(ok ? 'ok' : 'fail');
    setTesting(false);
  }

  function handleConnect() {
    onConfigChange({ ...config, apiKey: keyDraft, enabled: true });
    setKeyDraft('');
  }

  function handleDisconnect() {
    onConfigChange({ apiKey: '', model: config.model, enabled: false });
    setTestResult(null);
  }

  function downloadHistory() {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ossensa-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Settings</h2>
      </div>

      <div className="tabs">
        {([
          { id: 'openrouter', label: 'OpenRouter' },
          { id: 'preferences', label: 'Search preferences' },
          { id: 'export', label: 'Data export' },
          { id: 'about', label: 'About' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'openrouter' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>OpenRouter BYOK</h3>
            <span className={`badge ${config.enabled ? 'badge-preferred' : 'badge-count'}`}>
              {config.enabled ? '● Connected' : '○ Not connected'}
            </span>
          </div>

          {!config.enabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="alert alert-info">
                Your API key is stored in session memory only — it is never persisted to disk, localStorage, or logs.
              </div>
              <div className="form-group">
                <label htmlFor="or-key" className="form-label">API Key</label>
                <input
                  id="or-key"
                  type="password"
                  className="form-input"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="sk-or-…"
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="or-model" className="form-label">Model</label>
                <select
                  id="or-model"
                  className="form-select"
                  value={config.model}
                  onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
                >
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleTest}
                  disabled={!keyDraft.trim() || testing}
                  type="button"
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleConnect}
                  disabled={!keyDraft.trim() || testResult === 'fail'}
                  type="button"
                >
                  Connect
                </button>
              </div>
              {testResult === 'ok' && <div className="alert alert-info">✓ Connection successful</div>}
              {testResult === 'fail' && <div className="alert alert-error">✗ Connection failed — check your key</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="alert alert-info">
                AI-assisted summaries are enabled. Model: <strong>{config.model}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowContext((v) => !v)}
                  type="button"
                >
                  {showContext ? 'Hide' : 'Review'} context sent to AI
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDisconnect}
                  type="button"
                >
                  Disconnect
                </button>
              </div>
              {showContext && (
                <div className="card" style={{ background: 'var(--surface-2)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>
                    Context sent per search:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                    <li>Natural language query text</li>
                    <li>Up to 10 constraints (text + category)</li>
                    <li>Up to 5 candidate summaries (name, description, license, language, deployment modes)</li>
                  </ul>
                  <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)' }}>
                    Your API key is never included in the context payload.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'preferences' && (
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Search preferences</h3>
          <div className="form-group">
            <label className="form-label">Result count</label>
            <input
              type="text"
              className="form-input"
              value="5 (maximum)"
              readOnly
              style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}
              aria-label="Result count — fixed at 5"
            />
            <span className="form-label" style={{ fontStyle: 'italic' }}>
              Fixed at 5 to ensure quality comparisons. This is intentional by design.
            </span>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label htmlFor="stale-threshold" className="form-label">Evidence stale threshold (days)</label>
            <input
              id="stale-threshold"
              type="number"
              className="form-input"
              defaultValue={30}
              min={1}
              max={365}
              style={{ width: 120 }}
            />
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Data export</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Download your full search and decision history as JSON.
            {history.length === 0 && ' (Empty — no searches recorded yet.)'}
          </p>
          <button
            className="btn btn-secondary"
            onClick={downloadHistory}
            disabled={history.length === 0}
            type="button"
          >
            Download history JSON ↓
          </button>
        </div>
      )}

      {tab === 'about' && (
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>OSSensa</h3>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-muted)' }}>Version 0.1.0</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            Open-source software discovery and evaluation tool. Part of the Flowsensa ecosystem.
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
          >
            View source ↗
          </a>
        </div>
      )}
    </div>
  );
}
