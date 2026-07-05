# Tasks: OSSensa Product Build

> Status: Approved
> SDD Gate: tasks:approved
> Evidence date: 2026-07-05

## Implementation Slices

### Slice A — Project scaffold + design system (T01–T02)
### Slice B — Domain layer + source adapters (T03–T05)
### Slice C — Core UI: Search, Constraints, Results (T06–T09)
### Slice D — Comparison, Decisions, History (T10–T12)
### Slice E — AI integration + Settings (T13–T14)
### Slice F — Responsive, accessibility, deployment (T15–T17)

---

## Tasks

### T01 · Project scaffold
**Priority:** P0 | **Estimate:** 1h | **Dependencies:** none

**Work:**
- [ ] `npm create vite@latest ossensa -- --template react-ts`
- [ ] Install: `ajv`, `ajv-formats`
- [ ] Install devDeps: `oxlint`, `vitest`, `jsdom`, `@playwright/test`
- [ ] Create directory structure: `src/domain/`, `src/components/`, `src/lib/`, `src/styles/`
- [ ] Configure `vite.config.ts` with `base: "./"` and react plugin
- [ ] Configure `tsconfig.json` matching Flowsensa conventions
- [ ] Add npm scripts: `dev`, `build`, `lint`, `test`, `test:e2e`, `preview`
- [ ] Configure `playwright.config.ts` for local server
- [ ] Create `src/styles/tokens.css`, `src/styles/layout.css`, `src/styles/components.css`
- [ ] Implement light enterprise token system from design.md

**Acceptance criteria:**
- `npm run dev` serves an empty React app
- `npm run build` exits 0
- Token CSS loaded in browser

**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `src/styles/`
**Verification:** `npm run build && npm run lint`

---

### T02 · Domain types + application shell
**Priority:** P0 | **Estimate:** 1.5h | **Dependencies:** T01

**Work:**
- [ ] Create `src/domain/types.ts` with: `Constraint`, `SearchQuery`, `EvidenceItem`, `Candidate`, `CandidateComparison`, `Decision`, `SearchHistory`, `OpenRouterConfig` from design.md
- [ ] Create `src/App.tsx` shell: state for `query`, `constraints`, `candidates`, `comparisons`, `decisions`, `history`, `openRouterConfig`, `activeView`
- [ ] Views: `'search' | 'results' | 'history' | 'settings'`
- [ ] Top navigation: logo/brand left, nav links right, Settings button
- [ ] Mobile hamburger navigation
- [ ] Loading and empty states

**Acceptance criteria:**
- App renders without console errors
- All four views reachable by navigation
- Mobile nav works at 375px

**Files:** `src/App.tsx`, `src/domain/types.ts`, `src/styles/layout.css`
**Verification:** `npm run lint`, `npm run build`

---

### T03 · Deterministic search engine
**Priority:** P0 | **Estimate:** 2.5h | **Dependencies:** T02

**Work:**
- [ ] Create `src/domain/search.ts`:
  - `extractConstraints(naturalLanguage: string): Constraint[]` — keyword-based extractor (no AI)
  - `matchCandidate(candidate: Candidate, constraints: Constraint[]): ConstraintCoverage`
  - `rankCandidates(candidates: Candidate[], constraints: Constraint[]): Candidate[]` — score = required_met / required_total weighted
  - `applyResultCap(candidates: Candidate[], cap = 5): Candidate[]`
- [ ] Create `src/domain/comparison.ts`:
  - `buildComparison(candidate: Candidate, constraints: Constraint[]): CandidateComparison`
  - Plain-language fit verdict logic
- [ ] Create `tests/search.test.ts` with unit tests for ranking + cap enforcement

**Acceptance criteria:**
- Result cap enforced at domain layer: `rankCandidates(...).length <= 5`
- Candidates with disqualifying constraints excluded from results
- Unit tests pass

**Files:** `src/domain/search.ts`, `src/domain/comparison.ts`, `tests/search.test.ts`
**Verification:** `npm run test && npm run lint`

---

### T04 · Source adapters (GitHub + SPDX + OSV)
**Priority:** P1 | **Estimate:** 3h | **Dependencies:** T02

**Work:**
- [ ] Create `src/lib/githubAdapter.ts`:
  - `fetchRepo(owner, repo): Promise<Partial<Candidate>>` — stars, language, license, lastRelease
  - `fetchContributorActivity(owner, repo): Promise<EvidenceItem>`
  - CORS-safe: use `https://api.github.com` directly; note rate limit in JSDoc
- [ ] Create `src/lib/spdxAdapter.ts`: normalize license strings to SPDX identifiers
- [ ] Create `src/lib/osvAdapter.ts`: `fetchVulns(ecosystem, name): Promise<EvidenceItem[]>`
- [ ] Create `src/lib/searchOrchestrator.ts`: coordinates all adapters, builds `Candidate[]`, passes to `rankCandidates`
- [ ] Create `src/fixtures/synthetic-candidates.ts`: 6 synthetic candidates for demo mode (no API calls needed in demo)

**Acceptance criteria:**
- `fetchRepo` returns correct fields from GitHub API
- Demo mode uses synthetic candidates without network calls
- All adapter functions typed with correct return types

**Files:** `src/lib/githubAdapter.ts`, `src/lib/spdxAdapter.ts`, `src/lib/osvAdapter.ts`, `src/lib/searchOrchestrator.ts`, `src/fixtures/synthetic-candidates.ts`
**Verification:** `npm run lint`, `npm run build`

---

### T05 · Flowsensa import adapter
**Priority:** P2 | **Estimate:** 1h | **Dependencies:** T02

**Work:**
- [ ] Create `src/domain/flowsensaImport.ts`:
  - `parseFlowsensaToolingRequirement(json: unknown): SearchQuery` — extracts constraints from Flowsensa export JSON
  - Validates with AJV before parsing
- [ ] Add "Import from Flowsensa" button in SearchBar that accepts JSON file

**Acceptance criteria:**
- Valid Flowsensa tooling requirement JSON produces correct constraints
- Invalid JSON is rejected with an error message; existing state preserved

**Files:** `src/domain/flowsensaImport.ts`, `src/components/SearchBar.tsx`
**Verification:** `npm run test`, `npm run lint`

---

### T06 · SearchBar component
**Priority:** P0 | **Estimate:** 1h | **Dependencies:** T02

**Work:**
- [ ] Full-width text input, autofocused on load
- [ ] Placeholder text from design.md
- [ ] Submit → `extractConstraints()` → populate ConstraintEditor
- [ ] "Import from Flowsensa" secondary button (below input, not floating)
- [ ] Loading state during search
- [ ] Error state (network failure)

**Acceptance criteria:**
- Enter key submits search
- Import button visible and functional
- No layout overflow at 375px

**Files:** `src/components/SearchBar.tsx`
**Verification:** `npm run lint`

---

### T07 · ConstraintEditor component
**Priority:** P0 | **Estimate:** 3h | **Dependencies:** T02

**Work:**
- [ ] Three sections: Required / Preferred / Not Acceptable
- [ ] Each section header has plain-language effect explanation
- [ ] Each constraint: text display, type badge, edit icon, reclassify dropdown, delete ×
- [ ] "Add constraint" button per section
- [ ] Inline edit: click text → `<input>` in place, blur saves
- [ ] Reclassify: dropdown with three options or drag (keyboard fallback: dropdown)
- [ ] Technical term `data-term` chips → GlossaryTooltip
- [ ] "Re-run search" button anchored to ConstraintEditor header
- [ ] Count badges per section

**GlossaryTooltip sub-component:**
- [ ] `role="tooltip"`, `aria-describedby` wiring
- [ ] Keyboard: focus → show; Escape → close
- [ ] Touch: tap → overlay with close button
- [ ] Pointer: hover → show; leave → close
- [ ] Terms: Docker, API, REST, self-hosted, SPDX, OAuth, webhook, container, CLI

**Acceptance criteria:**
- All CRUD operations (add/remove/edit/reclassify) work
- GlossaryTooltip accessible via keyboard, touch, and pointer
- Re-run button triggers new search with updated constraints

**Files:** `src/components/ConstraintEditor.tsx`, `src/components/GlossaryTooltip.tsx`, `src/lib/glossary.ts`
**Verification:** `npm run lint`, `npm run build`, manual keyboard + touch test

---

### T08 · CandidateCard + result list
**Priority:** P1 | **Estimate:** 1.5h | **Dependencies:** T03, T07

**Work:**
- [ ] CandidateCard: name, one-line description, fit-verdict chip, language, license, last release, stars
- [ ] Fit verdict chip: Strong (green), Partial (blue), Uncertain (amber), Poor (red)
- [ ] "Compare" checkbox (max 2 selected)
- [ ] Click card → expand to ComparisonTable / ComparisonCards
- [ ] "5 results (max)" label shown when capped
- [ ] Empty state when no candidates

**Acceptance criteria:**
- Max 5 cards rendered regardless of adapter output
- All fields populated from `Candidate` type
- Expand/collapse works

**Files:** `src/components/CandidateCard.tsx`, `src/App.tsx`
**Verification:** `npm run lint`

---

### T09 · ComparisonTable (desktop) + ComparisonCards (mobile)
**Priority:** P1 | **Estimate:** 2.5h | **Dependencies:** T08

**Work:**
- [ ] ComparisonTable: all required columns from design.md (Summary, Fit verdict, Cover, Gaps, Setup effort, Ongoing responsibility, Evidence freshness, Unknowns, Advantages, Disadvantages)
- [ ] Advantages and Disadvantages: two-column aligned `<table>` structure per candidate
- [ ] `useMediaQuery('(max-width: 768px)')` hook → render ComparisonCards instead
- [ ] ComparisonCards: labeled `<dl>` rows, `<dt>` = field name, `<dd>` = value
- [ ] Advantages/Disadvantages in cards: labeled stacked with "Advantage +" / "Disadvantage −" `dt` prefixes
- [ ] Column widths stable; no horizontal overflow at 1024px+

**Acceptance criteria:**
- All 10 fields render in table and cards
- Advantages/Disadvantages are always aligned (not free prose)
- Mobile card shows all same fields as desktop table
- No horizontal scroll at 375px

**Files:** `src/components/ComparisonTable.tsx`, `src/components/ComparisonCards.tsx`
**Verification:** `npm run lint`, visual check at 375px and 1440px

---

### T10 · DecisionPanel
**Priority:** P1 | **Estimate:** 2h | **Dependencies:** T09

**Work:**
- [ ] Actions: Accept / Shortlist / Reject / Revisit (labeled buttons in panel header)
- [ ] Rationale text input: optional for Shortlist, required for Reject
- [ ] On Accept: save to history, show 3 export CTAs (SancusSight JSON, Mnemosync ref, Obsidian Markdown)
- [ ] Each export CTA: copies to clipboard or downloads file
- [ ] Obsidian export: structured Markdown with decision, rationale, evidence snapshot, date
- [ ] Decision state persisted to `localStorage` via `src/domain/history.ts`

**Acceptance criteria:**
- Reject without rationale is blocked with inline error
- Accept shows all 3 export options
- Decision survives page reload (localStorage)

**Files:** `src/components/DecisionPanel.tsx`, `src/domain/history.ts`
**Verification:** `npm run test`, `npm run lint`

---

### T11 · HistoryView
**Priority:** P2 | **Estimate:** 1.5h | **Dependencies:** T10

**Work:**
- [ ] List of past searches: date, abbreviated query, candidate name, decision, rationale excerpt
- [ ] "Re-open" button → restores prior constraint state into ConstraintEditor
- [ ] Stale evidence flag: warning chip if any evidence item `retrievedAt` > 30 days ago
- [ ] Similar-search banner: detect if current query shares ≥2 constraint keywords with prior decision
- [ ] Empty state with prompt to start searching

**Acceptance criteria:**
- Re-open restores exact prior constraint set
- Stale evidence chips appear correctly on old entries
- Similar-search banner triggers correctly

**Files:** `src/components/HistoryView.tsx`, `src/domain/history.ts`
**Verification:** `npm run test`, `npm run lint`

---

### T12 · SearchBar ↔ ConstraintEditor ↔ Results integration
**Priority:** P0 | **Estimate:** 1h | **Dependencies:** T06, T07, T08

**Work:**
- [ ] Wire search submit → constraint extraction → constraint editor population
- [ ] Wire "Re-run search" → `searchOrchestrator` → update candidates state
- [ ] Loading and error states across the full flow
- [ ] "Demo mode" toggle: uses synthetic candidates without API calls

**Acceptance criteria:**
- Full flow works: type query → constraints appear → re-run → cards appear
- Demo mode works without network access

**Files:** `src/App.tsx`
**Verification:** `npm run lint`, end-to-end manual flow

---

### T13 · AI-assisted search + OpenRouter client
**Priority:** P2 | **Estimate:** 2.5h | **Dependencies:** T14

**Work:**
- [ ] Create `src/lib/openrouterClient.ts` (identical pattern to Flowsensa)
- [ ] AI-assisted matching flow: after deterministic results, if key configured, send bounded context + get augmented summaries
- [ ] AI content appended to `CandidateComparison.laymanSummary` with `aiAugmented: true`
- [ ] Comparison renders AI badge: "AI-assisted summary — verify against linked evidence"
- [ ] Graceful fallback when no key: deterministic-only results, no error state

**Acceptance criteria:**
- Without key: results render correctly, no AI badge
- With key: AI badge visible, advisory label present
- Key never in DOM output

**Files:** `src/lib/openrouterClient.ts`, `src/App.tsx`, `src/components/ComparisonTable.tsx`
**Verification:** `npm run lint`, manual BYOK test

---

### T14 · SettingsView + OpenRouter BYOK
**Priority:** P1 | **Estimate:** 2h | **Dependencies:** T02

**Work:**
- [ ] SettingsView: 3 tabs — OpenRouter / Search preferences / Data export
- [ ] OpenRouter tab: identical design to Flowsensa T14 (password input, model selector, test, context review, disconnect, status chip)
- [ ] Search preferences: result display count (always 5, shown as read-only for clarity), evidence refresh threshold input
- [ ] Data export: download full history JSON button

**Acceptance criteria:**
- Same BYOK security constraints as Flowsensa (key never persisted)
- Test connection works against OpenRouter
- Data export downloads valid JSON

**Files:** `src/components/SettingsView.tsx`, `src/App.tsx`
**Verification:** `npm run lint`, manual BYOK test

---

### T15 · Responsive audit + fixes
**Priority:** P1 | **Estimate:** 2h | **Dependencies:** T01–T14

**Work:**
- [ ] Audit all views at 375px, 768px, 1024px, 1440px
- [ ] Fix all text overflow issues
- [ ] Fix all floating action positions (anchor to headers)
- [ ] Verify ComparisonTable → ComparisonCards transformation at 768px
- [ ] Verify GlossaryTooltip overlay on touch
- [ ] Add `docs/screenshots/` with desktop and mobile verification screenshots

**Acceptance criteria:**
- No horizontal page scroll at 375px
- All views render all content at 375px
- Table → card transformation fires at 768px

**Files:** `src/styles/*.css`, `docs/screenshots/`
**Verification:** Playwright screenshot tests

---

### T16 · Accessibility audit + fixes
**Priority:** P1 | **Estimate:** 1.5h | **Dependencies:** T15

**Work:**
- [ ] Verify all form inputs have associated `<label>`
- [ ] Verify constraint chips have keyboard equivalents (no hover-only)
- [ ] Verify fit verdict conveys state via text + icon, not color alone
- [ ] `aria-live` region for search status updates
- [ ] Contrast check: `--text` (#1a2133) on `--bg` (#f8f9fb) ≥ 4.5:1
- [ ] Contrast check: `--text-muted` (#5a6a85) on `--bg` (#f8f9fb) ≥ 3:1
- [ ] Full keyboard tab flow through search → constraints → results → decision

**Acceptance criteria:**
- No keyboard-inaccessible interactions
- Color contrast passes
- Tab order follows visual flow

**Files:** `src/styles/*.css`, `src/components/*.tsx`
**Verification:** `npm run lint`, manual keyboard audit

---

### T17 · Final build + deployment prep
**Priority:** P0 | **Estimate:** 1h | **Dependencies:** T01–T16

**Work:**
- [ ] `npm run lint` — zero errors
- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all Playwright tests pass
- [ ] `npm run build` — exit 0
- [ ] Create `README.md` with setup, environment variable docs, demo instructions
- [ ] Create `AGENTS.md` and `CLAUDE.md` pointing to `.ai/`
- [ ] Create `vercel.json` with SPA rewrite rule

**Acceptance criteria:**
- All four verification commands exit 0
- `dist/index.html` loads in browser from `file://`
- `vercel.json` present

**Files:** `README.md`, `AGENTS.md`, `CLAUDE.md`, `vercel.json`
**Verification:** `npm run lint && npm test && npm run build`

---

## Requirement Coverage

| Requirement | Task IDs |
|---|---|
| FR-001 | T06, T07, T12 |
| FR-002 | T05 |
| FR-003 | T04 |
| FR-004 | T04 |
| FR-005 | T03, T07 |
| FR-006 | T03, T08 |
| FR-007 | T09 |
| FR-008 | T11 |
| FR-009 | T11 |
| FR-010 | T13 |
| FR-011 | T10 |
| FR-012 | T10 |
| FR-014 | T10 |
| FR-017 | T07 |
| FR-018 | T09 |
| FR-019 | T13, T14 |
| NFR-006 | T15, T16 |
