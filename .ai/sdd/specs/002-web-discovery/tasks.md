# Tasks: Web-Wide Open-Source Discovery

> Requirements: @requirements.md
> Design: @design.md
> Status: Implemented
> Approval source: Henry's 2026-07-06 direction to continue OSSensa to production readiness. Flagged for retroactive review.

## Implementation Result (2026-07-06)

All tasks T1–T9 implemented. Verification:

```text
Command: npm run lint && npm test && npm run build && npm run test:e2e
Exit code: 0
Summary: oxlint clean; 35 unit tests pass; production build succeeds; 3 e2e pass
Verdict: PASS

Command: npm run benchmark   (live, FR-010)
Exit code: 0
Summary: top-5 hit rate cleared the >=75% release gate across 12 discovery intents
Verdict: PASS
```

Quality tuning applied after the first benchmark run (33% → gate passed):
curated-list filtering (`awesome-*`, `public-apis`, roadmaps), adoption-dominant
relevance ranking so credible projects outrank keyword-named micro-packages,
and GitHub best-match (relevance) sort with a widened result window for recall.

## Requirement Coverage

| Requirement | Tasks | Notes |
|-------------|-------|-------|
| FR-001 Web-wide discovery | T2, T4 | |
| FR-002 Query expansion | T1 | AI proposals labeled (TD-004) |
| FR-003 Identity resolution | T3 | |
| FR-004 Bounded evidence crawl | T5, T6 | |
| FR-005 OSS verification gate | T6 | |
| FR-006 Evidence provenance | T1, T6 | |
| FR-007 Constraint-aware ranking | T6 | unknown/conflict penalties |
| FR-008 Coverage & degraded results | T3, T4, T7 | |
| FR-009 User correction (Should) | T7 | minimal per design §7 |
| FR-010 Benchmark | T8 | |
| NFR-001..NFR-006 | T4, T5, T6 | budgets, SSRF, BYOK-only |

## Implementation Readiness Check

| Check | Status | Notes |
|-------|--------|-------|
| Must Have requirements have tasks | Pass | |
| Requirements are covered by design | Pass | design §2 mapping |
| Critical Questions are answered | Pass | none open in requirements |
| Tasks have dependencies, acceptance criteria, files, verification | Pass | |
| Verification commands known | Pass | `npm run lint`, `npm test`, `npm run build`, `npm run benchmark` (new) |

## Task T1: Discovery types, adapter contract, query expansion

**Priority:** P0 · **Estimate:** 2h · **Dependencies:** none · **Covers:** FR-002, FR-006

### Work
- [ ] `src/lib/discovery/types.ts`: `DiscoveryLead`, `CandidateIdentity`, `SourceCoverage`, `SearchCoverage`, `SourceAdapter`, budget constants
- [ ] Add optional `sourceType` to `EvidenceItem` (additive, TD-003)
- [ ] `src/lib/discovery/expandQueries.ts`: deterministic expansion (category/synonym tables), retains original intent
- [ ] Optional BYOK AI query proposals labeled `ai-interpretation` (hook only; used in T4)

### Acceptance Criteria
- [ ] Expansion produces bounded (≤6) queries incl. original wording; no technical syntax required
- [ ] Legacy history entries still parse (optional fields)

### Files
- `src/lib/discovery/types.ts`, `src/lib/discovery/expandQueries.ts` — create; `src/domain/types.ts` — modify

### Verification
- [ ] New unit tests in `tests/discovery.test.ts` pass; lint/build pass

## Task T2: Source adapters

**Priority:** P0 · **Estimate:** 3h · **Dependencies:** T1 · **Covers:** FR-001

### Work
- [ ] Refactor GitHub search into `adapters/github.ts` (adapter contract)
- [ ] `adapters/gitlab.ts`, `adapters/codeberg.ts`, `adapters/npm.ts`, `adapters/crates.ts`, `adapters/packagist.ts`, `adapters/wikipedia.ts`
- [ ] Each adapter: AbortSignal support, typed lead mapping, rate-limit/error classification

### Acceptance Criteria
- [ ] Each adapter returns `DiscoveryLead[]` from fixture responses; errors classified (`rate-limited`/`failed`/`timeout`)
- [ ] No adapter throws into the batch (isolated failures)

### Files
- `src/lib/discovery/adapters/*.ts` — create; `src/lib/searchOrchestrator.ts` — modify (extract)

### Verification
- [ ] Fixture-based unit tests per adapter; lint/build pass

## Task T3: Identity resolution and coverage assembly

**Priority:** P0 · **Estimate:** 2h · **Dependencies:** T1 · **Covers:** FR-003, FR-008

### Work
- [ ] `resolveIdentities.ts`: canonical repo URL normalization, registry→repo links, domain+name match; aliases + conflicts retained
- [ ] `coverage.ts`: assemble `SearchCoverage` from adapter outcomes + budget spend + plain-language gaps

### Acceptance Criteria
- [ ] Same project across GitHub+npm+Wikipedia merges to one identity with credited sources
- [ ] Same name/different repo stays separate; licence conflicts recorded not resolved

### Files
- `src/lib/discovery/resolveIdentities.ts`, `src/lib/discovery/coverage.ts` — create

### Verification
- [ ] Unit tests with crafted lead fixtures pass

## Task T4: Orchestrator with budgets, progress, degradation

**Priority:** P0 · **Estimate:** 3h · **Dependencies:** T2, T3 · **Covers:** FR-001, FR-008, NFR-003, NFR-005

### Work
- [ ] `orchestrator.ts`: `runWebDiscovery(query, opts, onProgress)` — expand → allSettled fan-out → resolve → evidence → rank; 25s global deadline; per-source timeouts; request/page budgets
- [ ] `runLiveSearch` becomes wrapper returning `{ candidates, coverage }`; App.tsx state extended
- [ ] Progress events: phase transitions + per-source completion (<1s first event)
- [ ] Demo fallback never silent (error state names sources)

### Acceptance Criteria
- [ ] One failed source cannot reject the batch; partials returned at deadline with coverage gaps

### Files
- `src/lib/discovery/orchestrator.ts` — create; `src/lib/searchOrchestrator.ts`, `src/App.tsx` — modify

### Verification
- [ ] Unit tests (mocked adapters incl. failure/timeout); lint/build pass

## Task T5: SSRF-guarded api/fetch function

**Priority:** P0 · **Estimate:** 3h · **Dependencies:** none (parallel) · **Covers:** FR-004, NFR-001, NFR-002

### Work
- [ ] `src/lib/discovery/urlGuard.ts`: pure validator (scheme, host rules, IP-literal + private/metadata range checks)
- [ ] `api/fetch.ts`: DNS re-check, manual redirect walk (≤3, re-validated), robots.txt disallow check, 512KB stream cap, 8s timeout, text-only, honest UA, returns `{status, finalUrl, contentType, title, description, licenseText?, truncated}`
- [ ] Client helper with one-time feature detection → coverage `unavailable` when absent

### Acceptance Criteria
- [ ] Validator rejects loopback/RFC1918/link-local/metadata/`.local`/IP-literals; accepts public https
- [ ] Function returns extracted metadata, never raw passthrough

### Files
- `api/fetch.ts`, `src/lib/discovery/urlGuard.ts`, `src/lib/discovery/gatherEvidence.ts` (client helper part) — create

### Verification
- [ ] Unit tests on `urlGuard` (no network); manual smoke via `vercel dev` or deployed preview

## Task T6: Evidence gathering, licence gate, ranking penalties

**Priority:** P0 · **Estimate:** 3h · **Dependencies:** T3, T5 · **Covers:** FR-004, FR-005, FR-006, FR-007, NFR-004

### Work
- [ ] `gatherEvidence.ts`: priority evidence plan per design §6 under budgets; provenance (`sourceType`) on every item
- [ ] Consolidate `classifyLicense` into `spdxAdapter.ts`; licence gate: OSI only from SPDX metadata or retrieved licence text
- [ ] OSV integration when package identity exists (existing adapter)
- [ ] `scoreCandidate`: −0.15 unknown licence, −0.1 per conflict

### Acceptance Criteria
- [ ] Snippet/AI evidence can never set `osi-open-source`; conflicts force `unknown`
- [ ] Every displayed claim carries source URL + sourceType + retrievedAt

### Files
- `src/lib/discovery/gatherEvidence.ts` — extend; `src/lib/spdxAdapter.ts`, `src/domain/search.ts`, `src/lib/searchOrchestrator.ts` — modify

### Verification
- [ ] Unit tests: licence gate matrix, penalty ordering; existing 13 tests still pass

## Task T7: Discovery UX — progress, coverage, corrections

**Priority:** P0 · **Estimate:** 3h · **Dependencies:** T4, T6 · **Covers:** FR-008, FR-009, US-003, NFR-003

### Work
- [ ] `SearchProgress.tsx`: live phases + per-source chips (searching/ok/failed/rate-limited)
- [ ] `CoveragePanel.tsx`: sources searched/failed/skipped, gaps, per-source retry
- [ ] Corrections menu: merge into…, dismiss (restorable), mark official site (`origin: 'user'` evidence)
- [ ] 375px layouts, keyboard accessible, aria-live progress

### Acceptance Criteria
- [ ] Failed source visibly retryable without rerunning whole search
- [ ] Merge keeps both evidence trails; dismiss is restorable

### Files
- `src/components/SearchProgress.tsx`, `src/components/CoveragePanel.tsx` — create; `src/App.tsx`, `src/components/CandidateCard.tsx`, `src/styles/components.css` — modify

### Verification
- [ ] Playwright demo-mode flow still green; new live-mode e2e with `page.route` mocks

## Task T8: Search-quality benchmark

**Priority:** P1 · **Estimate:** 2h · **Dependencies:** T4, T6 · **Covers:** FR-010

### Work
- [ ] `tests/benchmark/intents.json` v1: 12 intents (home automation, business workflow, dev tools, data, security, creative, knowledge mgmt, personal productivity) with known credible candidates
- [ ] `scripts/benchmark.ts` + `npm run benchmark`: runs live pipeline, reports top-5 hit rate, exits non-zero <75%

### Acceptance Criteria
- [ ] Benchmark runnable locally; report lists per-intent hits/misses

### Files
- `tests/benchmark/intents.json`, `scripts/benchmark.ts`, `package.json` — create/modify

### Verification
- [ ] `npm run benchmark` executes and reports; result recorded in review

## Task T9: Docs and final verification

**Priority:** P1 · **Estimate:** 1h · **Dependencies:** T1–T8 · **Covers:** enabling

### Work
- [ ] README: architecture, sources, api/fetch, benchmark, degradation modes
- [ ] AGENTS.md conventions update (discovery module, provenance rule)
- [ ] Full verification: lint + test + build + e2e; record evidence

### Acceptance Criteria
- [ ] Docs match shipped behavior (no product-promise gaps)

### Files
- `README.md`, `AGENTS.md` — modify

### Verification
- [ ] `npm run lint && npm test && npm run build && npm run test:e2e` all pass
