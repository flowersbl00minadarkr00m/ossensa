import { useState, useCallback } from 'react';
import type {
  ActiveView,
  Candidate,
  CandidateComparison,
  Constraint,
  Decision,
  OpenRouterConfig,
  SearchHistory,
  SearchQuery,
} from './domain/types';
import { extractConstraints } from './domain/search';
import { buildComparison } from './domain/comparison';
import { loadHistory, saveHistory, addHistoryEntry, updateDecisionInHistory } from './domain/history';
import { runDemoSearch, runLiveSearch } from './lib/searchOrchestrator';
import { augmentComparisons } from './lib/openrouterClient';
import { SearchBar } from './components/SearchBar';
import { ConstraintEditor } from './components/ConstraintEditor';
import { CandidateCard } from './components/CandidateCard';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { DecisionPanel } from './components/DecisionPanel';

export default function App() {
  // ── View state ──────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('search');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ── Search state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState<SearchQuery | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [comparisons, setComparisons] = useState<CandidateComparison[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // ── History + settings ──────────────────────────────────────────────────────
  const [history, setHistory] = useState<SearchHistory[]>(() => loadHistory());
  const [openRouterConfig, setOpenRouterConfig] = useState<OpenRouterConfig>({
    apiKey: '',
    model: 'openai/gpt-5.5',
    enabled: false,
  });

  // ── Search execution ────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: SearchQuery, overrideConstraints?: Constraint[]) => {
    const activeConstraints = overrideConstraints ?? q.constraints;
    const fullQuery = { ...q, constraints: activeConstraints };

    setLoading(true);
    setSearchError(null);

    try {
      const results = demoMode
        ? await runDemoSearch(fullQuery)
        : await runLiveSearch(fullQuery);

      let comps = results.map((c) => buildComparison(c, activeConstraints));

      // AI augmentation if key available
      if (openRouterConfig.enabled && openRouterConfig.apiKey) {
        comps = await augmentComparisons(
          { apiKey: openRouterConfig.apiKey, model: openRouterConfig.model },
          q.naturalLanguage,
          activeConstraints,
          results,
          comps,
        );
      }

      setCandidates(results);
      setComparisons(comps);
      setDecisions([]);
      setSelectedForCompare([]);

      // Persist to history
      const entry: SearchHistory = {
        id: `h-${Date.now()}`,
        query: fullQuery,
        candidates: results,
        comparisons: comps,
        decisions: [],
        searchedAt: new Date().toISOString(),
      };
      const updated = addHistoryEntry(history, entry);
      setHistory(updated);
      saveHistory(updated);

      setActiveView('results');
    } catch (err) {
      setSearchError((err as Error).message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [demoMode, history, openRouterConfig]);

  // ── Search initiation from SearchBar ────────────────────────────────────────
  function handleSearch(q: SearchQuery) {
    const extracted = q.constraints.length > 0
      ? q.constraints
      : extractConstraints(q.naturalLanguage);
    setQuery(q);
    setConstraints(extracted);
    runSearch(q, extracted);
  }

  // ── Re-run from ConstraintEditor ─────────────────────────────────────────────
  function handleRerun() {
    if (!query) return;
    runSearch(query, constraints);
  }

  // ── Decision recording ────────────────────────────────────────────────────────
  function handleDecide(decision: Decision) {
    const updated = [...decisions.filter((d) => d.candidateId !== decision.candidateId), decision];
    setDecisions(updated);

    if (query) {
      const histUpdated = updateDecisionInHistory(history, query.id, decision);
      setHistory(histUpdated);
      saveHistory(histUpdated);
    }
  }

  // ── History reopen ────────────────────────────────────────────────────────────
  function handleReopen(entry: SearchHistory) {
    setQuery(entry.query);
    setConstraints(entry.query.constraints);
    setCandidates(entry.candidates);
    setComparisons(entry.comparisons);
    setDecisions(entry.decisions);
    setActiveView('results');
    setMobileNavOpen(false);
  }

  // ── Compare selection ────────────────────────────────────────────────────────
  function toggleCompare(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, id];
    });
  }

  function nav(view: ActiveView) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  return (
    <div className={`app-shell${mobileNavOpen ? ' nav-mobile-open' : ''}`}>
      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-inner">
          <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); nav('search'); }}>
            <span>OSS</span><span className="accent">ensa</span>
          </a>
          <div className={`nav-links${mobileNavOpen ? ' mobile-open' : ''}`}>
            <button className={`nav-link ${activeView === 'search' ? 'active' : ''}`} onClick={() => nav('search')} type="button">Search</button>
            {candidates.length > 0 && (
              <button className={`nav-link ${activeView === 'results' ? 'active' : ''}`} onClick={() => nav('results')} type="button">
                Results {candidates.length > 0 && <span className="badge badge-count" style={{ marginLeft: 4 }}>{candidates.length}</span>}
              </button>
            )}
            <button className={`nav-link ${activeView === 'history' ? 'active' : ''}`} onClick={() => nav('history')} type="button">History</button>
            <button className={`nav-link ${activeView === 'settings' ? 'active' : ''}`} onClick={() => nav('settings')} type="button">Settings</button>
          </div>
          <button
            className="nav-hamburger"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-label="Toggle navigation menu"
            type="button"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="main-content" id="main">
        {/* Search view */}
        {activeView === 'search' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
                Find open-source software
              </h1>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                Describe what you need in plain language. We'll extract constraints and find the best matches.
              </p>
            </div>

            <SearchBar onSearch={handleSearch} loading={loading} error={searchError} />

            {constraints.length > 0 && (
              <ConstraintEditor
                constraints={constraints}
                onChange={setConstraints}
                onRerun={handleRerun}
                loading={loading}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                />
                Demo mode (uses synthetic candidates, no API calls)
              </label>
            </div>
          </div>
        )}

        {/* Results view */}
        {activeView === 'results' && (
          <div>
            <div className="section-header">
              <h2 className="section-title">
                Results
                {candidates.length > 0 && (
                  <span className="badge badge-count" style={{ marginLeft: 8 }}>
                    {candidates.length} (max 5)
                  </span>
                )}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('search')} type="button">
                ← New search
              </button>
            </div>

            {query && (
              <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Query
                </p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{query.naturalLanguage}</p>
              </div>
            )}

            {constraints.length > 0 && (
              <ConstraintEditor
                constraints={constraints}
                onChange={setConstraints}
                onRerun={handleRerun}
                loading={loading}
              />
            )}

            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                Searching…
              </div>
            )}

            {!loading && candidates.length === 0 && (
              <div className="empty-state">
                <h3>No results</h3>
                <p>Try adjusting your constraints or switching to demo mode.</p>
              </div>
            )}

            {/* Live results with aria-live for search status */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {!loading && candidates.length > 0 && `${candidates.length} result${candidates.length !== 1 ? 's' : ''} found`}
            </div>

            {candidates.map((candidate, i) => {
              const comp = comparisons.find((c) => c.candidateId === candidate.id);
              if (!comp) return null;
              return (
                <div key={candidate.id}>
                  <CandidateCard
                    candidate={candidate}
                    comparison={comp}
                    index={i}
                    isCapped={candidates.length >= 5}
                    selected={selectedForCompare.includes(candidate.id)}
                    onToggleSelect={() => toggleCompare(candidate.id)}
                  />
                  {query && (
                    <DecisionPanel
                      candidate={candidate}
                      comparison={comp}
                      query={query}
                      existingDecision={decisions.find((d) => d.candidateId === candidate.id)}
                      onDecide={handleDecide}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* History view */}
        {activeView === 'history' && (
          <HistoryView
            history={history}
            currentQuery={query?.naturalLanguage}
            onReopen={handleReopen}
          />
        )}

        {/* Settings view */}
        {activeView === 'settings' && (
          <SettingsView
            config={openRouterConfig}
            onConfigChange={setOpenRouterConfig}
            history={history}
          />
        )}
      </main>

      <style>{`
        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
}
