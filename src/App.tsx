import { useState, useCallback, useEffect } from 'react';
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
import { runDemoSearch, runLiveSearch, retrySource } from './lib/searchOrchestrator';
import type { DiscoveryProgress, SearchCoverage } from './lib/discovery/types';
import { augmentComparisons } from './lib/openrouterClient';
import { SearchBar } from './components/SearchBar';
import { SearchProgress } from './components/SearchProgress';
import { CoveragePanel } from './components/CoveragePanel';
import { ConstraintEditor } from './components/ConstraintEditor';
import { CandidateCard } from './components/CandidateCard';
import { CandidateDetail } from './components/CandidateDetail';
import { ComparisonTable } from './components/ComparisonTable';
import { ComparisonCards } from './components/ComparisonCards';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  // ── View state ──────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('search');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Mobile nav overlay management
  function openMobileNav() { document.body.style.overflow = 'hidden'; setMobileNavOpen(true); }
  function closeMobileNav() { document.body.style.overflow = ''; setMobileNavOpen(false); }

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMobileNav();
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, []);

  function nav(view: ActiveView) {
    setActiveView(view);
    closeMobileNav();
  }

  // ── Search state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState<SearchQuery | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [comparisons, setComparisons] = useState<CandidateComparison[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<SearchCoverage | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [retryingSource, setRetryingSource] = useState<string | null>(null);

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
    setProgress(null);
    setCoverage(null);

    try {
      let results;
      if (demoMode) {
        results = await runDemoSearch(fullQuery);
      } else {
        const discovery = await runLiveSearch(fullQuery, { onProgress: setProgress });
        results = discovery.candidates;
        setCoverage(discovery.coverage);
        if (results.length === 0) {
          const failed = discovery.coverage.sources.filter(
            (s) => s.status !== 'ok' && s.status !== 'empty',
          );
          if (failed.length === discovery.coverage.sources.length) {
            setSearchError(
              `No sources could be searched (${failed.map((s) => s.label).join(', ')}). Check your connection and retry — demo data is never substituted automatically.`,
            );
          }
        }
      }

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
      setSelectedCandidateId(results[0]?.id ?? null);

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
      setProgress(null);
    }
  }, [demoMode, history, openRouterConfig]);

  // ── Coverage: retry a single failed source (FR-008) ────────────────────────
  async function handleRetrySource(sourceId: string) {
    if (!query || !coverage) return;
    setRetryingSource(sourceId);
    try {
      const merged = await retrySource(query, sourceId, { candidates, coverage });
      setCandidates(merged.candidates);
      setCoverage(merged.coverage);
      setComparisons((prev) =>
        merged.candidates.map(
          (c) => prev.find((p) => p.candidateId === c.id) ?? buildComparison(c, constraints),
        ),
      );
    } finally {
      setRetryingSource(null);
    }
  }

  // ── User corrections (FR-009) ───────────────────────────────────────────────
  function setDismissed(id: string, dismissed: boolean) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, dismissed } : c)));
    if (dismissed && selectedCandidateId === id) setSelectedCandidateId(null);
    setSelectedForCompare((prev) => prev.filter((x) => x !== id));
  }

  function handleMarkOfficial(id: string) {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              projectUrl: c.repoUrl,
              evidence: [
                ...c.evidence,
                {
                  claim: 'Repository marked as the official project page',
                  source: 'user',
                  sourceUrl: c.repoUrl,
                  retrievedAt: new Date().toISOString(),
                  confidence: 'high' as const,
                  sourceType: 'structured-metadata' as const,
                  origin: 'user' as const,
                },
              ],
            }
          : c,
      ),
    );
  }

  function handleMergeSelected() {
    if (selectedForCompare.length !== 2) return;
    const [targetId, sourceId] = selectedForCompare;
    const target = candidates.find((c) => c.id === targetId);
    const source = candidates.find((c) => c.id === sourceId);
    if (!target || !source) return;

    const mergedCandidate = {
      ...target,
      aliases: [...new Set([...(target.aliases ?? []), source.name, ...(source.aliases ?? [])])],
      conflicts: [...new Set([...(target.conflicts ?? []), ...(source.conflicts ?? [])])],
      sources: [...new Set([...(target.sources ?? []), ...(source.sources ?? [])])],
      evidence: [...target.evidence, ...source.evidence],
    };
    setCandidates((prev) =>
      prev.filter((c) => c.id !== sourceId).map((c) => (c.id === targetId ? mergedCandidate : c)),
    );
    setComparisons((prev) =>
      prev
        .filter((p) => p.candidateId !== sourceId)
        .map((p) => (p.candidateId === targetId ? buildComparison(mergedCandidate, constraints) : p)),
    );
    setSelectedForCompare([]);
    setSelectedCandidateId(targetId);
  }

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
    setSelectedCandidateId(entry.candidates[0]?.id ?? null);
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

  const visibleCandidates = candidates.filter((candidate) => !candidate.dismissed);
  const dismissedCandidates = candidates.filter((candidate) => candidate.dismissed);
  const selectedCandidate =
    visibleCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? visibleCandidates[0];
  const selectedComparison = selectedCandidate
    ? comparisons.find((comparison) => comparison.candidateId === selectedCandidate.id)
    : undefined;
  const compareCandidates = visibleCandidates.filter((candidate) =>
    selectedForCompare.includes(candidate.id),
  );
  const compareComparisons = comparisons.filter((comparison) =>
    selectedForCompare.includes(comparison.candidateId),
  );

  return (
    <div className={`app-shell${mobileNavOpen ? ' nav-mobile-open' : ''}`}>
      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="nav" aria-label="Main navigation" onKeyDown={(e) => { if (e.key === 'Escape') closeMobileNav(); }}>
        {/* Mobile backdrop overlay */}
        {mobileNavOpen && (
          <div
            className="nav-backdrop"
            onClick={closeMobileNav}
            aria-hidden="true"
          />
        )}
        <div className="nav-inner">
          <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); nav('search'); }}>
            <span className="brand-os">OS</span><span className="brand-sensa">Sensa</span>
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
            onClick={() => mobileNavOpen ? closeMobileNav() : openMobileNav()}
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
            <div className="search-hero">
              <span className="eyebrow">Open-source discovery</span>
              <h1>
                Find open-source software
              </h1>
              <p>
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

            <div className="demo-toggle-row">
              <label className="demo-toggle">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                />
                Use demo data (synthetic candidates, no API calls)
              </label>
            </div>
          </div>
        )}

        {/* Results view */}
        {activeView === 'results' && (
          <div>
            <header className="results-toolbar">
              <div>
                <span className="eyebrow">Software discovery</span>
                <h1>{visibleCandidates.length} matches for your workflow</h1>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => nav('search')} type="button">
                New search
              </button>
              {query && <p className="results-query">{query.naturalLanguage}</p>}
              <div className="filter-strip" aria-label="Active constraints">
                {constraints.slice(0, 5).map((constraint) => (
                  <span key={constraint.id} className={`filter-chip filter-${constraint.category}`}>
                    {constraint.text}
                  </span>
                ))}
                <button className="filter-edit" type="button" onClick={() => nav('search')}>
                  Edit constraints
                </button>
              </div>
            </header>

            {loading && progress && <SearchProgress progress={progress} />}
            {loading && !progress && (
              <div className="loading-state">
                <div className="spinner" />
                Searching…
              </div>
            )}

            {!loading && coverage && (
              <CoveragePanel
                coverage={coverage}
                onRetrySource={handleRetrySource}
                retryingSource={retryingSource}
              />
            )}

            {!loading && visibleCandidates.length === 0 && (
              <div className="empty-state">
                <h3>No verified results</h3>
                <p>
                  {coverage && coverage.gaps.length > 0
                    ? 'Some sources could not be searched — expand the coverage report above to retry them.'
                    : 'Try broadening your description or adjusting your constraints.'}
                  {' '}Demo data is never substituted automatically.
                </p>
              </div>
            )}

            {/* Live results with aria-live for search status */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {!loading && candidates.length > 0 && `${candidates.length} result${candidates.length !== 1 ? 's' : ''} found`}
            </div>

            {selectedForCompare.length > 0 && (
              <section className="compare-board" aria-label="Candidate comparison">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Comparison</span>
                    <h2 className="section-title">{selectedForCompare.length} of 2 candidates selected</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedForCompare.length === 2 && (
                      <button className="btn btn-secondary btn-sm" type="button" onClick={handleMergeSelected}>
                        Merge duplicates
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelectedForCompare([])}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="comparison-desktop">
                  <ComparisonTable candidates={compareCandidates} comparisons={compareComparisons} />
                </div>
                <div className="comparison-mobile">
                  <ComparisonCards candidates={compareCandidates} comparisons={compareComparisons} />
                </div>
              </section>
            )}

            {!loading && visibleCandidates.length > 0 && query && (
              <div className="results-workspace">
                <section className="result-list" aria-label="Search results">
                  <div className="result-list-heading">
                    <span>Best matches</span>
                    <span>Ranked by constraint coverage</span>
                  </div>
                  {visibleCandidates.map((candidate, index) => {
                    const comparison = comparisons.find((item) => item.candidateId === candidate.id);
                    if (!comparison) return null;
                    return (
                      <CandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        comparison={comparison}
                        index={index}
                        active={candidate.id === selectedCandidate?.id}
                        selected={selectedForCompare.includes(candidate.id)}
                        compareDisabled={selectedForCompare.length >= 2}
                        onSelect={() => setSelectedCandidateId(candidate.id)}
                        onToggleSelect={() => toggleCompare(candidate.id)}
                      />
                    );
                  })}
                </section>
                {selectedCandidate && selectedComparison && (
                  <CandidateDetail
                    key={selectedCandidate.id}
                    candidate={selectedCandidate}
                    comparison={selectedComparison}
                    query={query}
                    decision={decisions.find((decision) => decision.candidateId === selectedCandidate.id)}
                    onDecide={handleDecide}
                    onDismiss={() => setDismissed(selectedCandidate.id, true)}
                    onMarkOfficial={() => handleMarkOfficial(selectedCandidate.id)}
                  />
                )}
              </div>
            )}

            {!loading && dismissedCandidates.length > 0 && (
              <section className="dismissed-list" aria-label="Dismissed results">
                <h3>Dismissed</h3>
                {dismissedCandidates.map((candidate) => (
                  <div key={candidate.id} className="dismissed-item">
                    <span>{candidate.name}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => setDismissed(candidate.id, false)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </section>
            )}
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

      <footer className="risk-disclaimer">
        <p>
          <strong>OSSensa is a research aid, not a security certification.</strong>
          Every candidate shows OSI open source, source-available, proprietary, or unknown classification;
          provenance and official repository; maintenance and release activity;
          package-specific vulnerability evidence when a reliable <a href="https://osv.dev" target="_blank" rel="noopener">OSV</a> identity is available;
          archived or abandoned status; installation and operating responsibility;
          evidence freshness; and material unknowns.
          Verify all claims against the project&rsquo;s own documentation before making decisions.
        </p>
      </footer>
    </div>
  );
}
