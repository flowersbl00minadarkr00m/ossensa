# Design: OSSensa Product

> Status: Approved
> SDD Gate: design:approved
> Evidence date: 2026-07-05

## Overview

OSSensa is a brand-new React/Vite/TypeScript application (no existing codebase). It presents a restrained light enterprise UI for discovering and evaluating open-source software. Natural-language search is the primary entry. Constraint editing is central. Results are capped at 5 candidates with plain-language comparisons accessible to both developers and moderately tech-savvy managers.

---

## Architecture

```
src/
  domain/
    types.ts            ← all domain types
    search.ts           ← deterministic constraint matching + ranking
    comparison.ts       ← plain-language comparison builder
    history.ts          ← search/decision history (localStorage)
    openrouterClient.ts ← BYOK connector (shared pattern with Flowsensa)
    flowsensaImport.ts  ← parse Flowsensa tooling-requirement JSON
  components/
    SearchBar.tsx
    ConstraintEditor.tsx
    CandidateCard.tsx
    ComparisonTable.tsx
    ComparisonCards.tsx   ← mobile equivalent
    DecisionPanel.tsx
    HistoryView.tsx
    SettingsView.tsx
    GlossaryTooltip.tsx
    TechTermExplainer.tsx
  App.tsx
  main.tsx
  styles/
    tokens.css
    layout.css
    components.css
```

---

## Visual Design System

### Direction: restrained light enterprise

White/light-grey backgrounds, dark text, one blue accent, no gradient blobs.

```css
:root {
  /* Light enterprise system */
  --bg:           #f8f9fb;
  --surface:      #ffffff;
  --surface-2:    #f1f3f7;
  --border:       #d8dce6;
  --border-light: #eaedf3;

  /* Text */
  --text:         #1a2133;
  --text-muted:   #5a6a85;
  --text-dim:     #8a9ab5;

  /* Accent */
  --accent:       #2563eb;
  --accent-hover: #1d4ed8;
  --accent-dim:   rgba(37,99,235,0.08);

  /* Semantic */
  --success:      #059669;
  --warning:      #d97706;
  --danger:       #dc2626;
  --info:         #0284c7;

  /* Typography */
  --font-sans:    'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* Sizing */
  --max-content:  1100px;
  --radius:       6px;
  --radius-lg:    10px;
}
```

---

## Application Flow

```
Landing / Search
  → ConstraintEditor (add/edit/remove/reclassify constraints)
    → Deterministic matching + ranking (max 5)
      → ComparisonTable (desktop) / ComparisonCards (mobile)
        → DecisionPanel (Accept, Shortlist, Reject, Revisit)
          → saved to History + optional exports
```

---

## Component Designs

### SearchBar

- Full-width text input, prominent, first focused element
- Placeholder: "Describe what you need, e.g. 'self-hosted workflow automation with a REST API'"
- Submit triggers constraint extraction + search
- "Import from Flowsensa" secondary action button (secondary, below input)
- No floating elements

### ConstraintEditor

**Purpose:** Central workspace for managing search requirements before running.

**Layout:**
- Three collapsible sections: Required / Preferred / Not Acceptable
- Each section header explains its effect in plain language:
  - Required: "Candidates that don't meet these are excluded from results"
  - Preferred: "Candidates that meet these are ranked higher"
  - Not Acceptable: "Any candidate with these traits is excluded"
- Each constraint shows: text, type badge, edit (pencil icon), reclassify (drag or dropdown), delete (×)
- "Add constraint" button at the bottom of each section
- Technical term chips (e.g. "Docker") trigger `GlossaryTooltip` on hover, focus, and tap
- "Re-run search" button anchored to ConstraintEditor section header (not floating)
- Inline constraint count badges per section

**GlossaryTooltip component:**
- `role="tooltip"`, triggered by `aria-describedby`
- Keyboard: `focus` on term chip → tooltip visible; `Escape` closes
- Touch: tap opens tooltip overlay with close button
- Pointer: hover shows tooltip, leave closes
- Never uses `title` attribute alone as it's inaccessible

### CandidateCard (search results list)

- Max 5 cards rendered
- Each shows: project name, one-line description, fit verdict chip (Strong fit / Partial fit / Uncertain / Poor fit), primary language, license, last release date, GitHub stars
- "Compare" checkbox (max 2 selected for side-by-side)
- Click → expands to ComparisonTable or ComparisonCards

### ComparisonTable (desktop ≥768px)

**Required columns:**
| Field | Description |
|---|---|
| Summary | Plain-language layperson description |
| Fit verdict | Strong / Partial / Uncertain / Poor |
| Cover | Which required/preferred constraints it meets |
| Gaps | What it's missing |
| Setup effort | Low / Medium / High with explanation |
| Ongoing responsibility | What you'd own operationally |
| Evidence freshness | Last-checked date per claim |
| Unknowns | What couldn't be determined |
| Advantages | Bulleted list |
| Disadvantages | Bulleted list |

**Layout rule:** Advantages and Disadvantages use two aligned columns per candidate in a `<table>` structure — never free-flowing prose for these two fields.

### ComparisonCards (mobile <768px)

- Each candidate becomes a card with labeled rows for every field above
- Advantages/Disadvantages shown as labeled stacked `<dl>` with `dt` (Advantage / Disadvantage) and `dd` (the point)

### DecisionPanel

- Actions: Accept / Shortlist / Reject / Revisit (defer)
- Each action requires a rationale text field (optional for Shortlist, required for Reject)
- On Accept:
  1. Saves to history with evidence snapshot
  2. Offers "Copy SancusSight handoff JSON"
  3. Offers "Create Mnemosync task reference" (manual copy)
  4. Offers "Export Obsidian decision record" (downloads Markdown)
- Actions anchored to DecisionPanel header, never floating

### HistoryView

- List of past searches: date, query, decision, candidate
- "Re-open" → restores constraint editor to prior state
- Stale evidence flagged with warning chip if age > 30 days
- Similar-search detection: shows banner if current query overlaps prior decision

### SettingsView

**Sections:**
1. OpenRouter BYOK (same pattern as Flowsensa — see below)
2. Search preferences (result count display, evidence refresh threshold)
3. Data export (download full history JSON)
4. About / version

---

## OpenRouter BYOK

Same design as Flowsensa design.md:
- Session-only key in React state
- `<input type="password">`, masked
- Model selector, default `openai/gpt-5.5`
- Test connection button
- Context review expandable (shows bounded query + evidence summaries)
- Disconnect clears key from memory
- Status chip
- Key never logged, stored, or exported

### AI-assisted matching flow

1. User completes constraint editor and clicks "Run AI-assisted search"
2. Deterministic matching runs first (always)
3. If key configured: send bounded context (query + constraints + up to 5 candidate summaries) to OpenRouter
4. AI response augments plain-language summaries only; does not override deterministic scores
5. AI content labeled: "AI-assisted summary — verify against linked evidence"

---

## Domain Types

```typescript
interface Constraint {
  id: string;
  text: string;
  category: 'required' | 'preferred' | 'not-acceptable';
  createdAt: string;
}

interface SearchQuery {
  id: string;
  naturalLanguage: string;
  constraints: Constraint[];
  submittedAt: string;
  source: 'manual' | 'flowsensa-import';
}

interface EvidenceItem {
  claim: string;
  source: string;          // e.g. "GitHub API"
  sourceUrl: string;
  retrievedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Candidate {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  projectUrl?: string;
  license: string;         // SPDX identifier
  lastRelease: string;
  stars: number;
  language: string;
  deploymentModes: ('hosted' | 'self-hosted' | 'hybrid')[];
  evidence: EvidenceItem[];
  constraintCoverage: {
    required: { met: Constraint[]; missed: Constraint[] };
    preferred: { met: Constraint[]; missed: Constraint[] };
    disqualified: boolean;
    disqualifyingConstraints: Constraint[];
  };
}

interface CandidateComparison {
  candidateId: string;
  fitVerdict: 'strong' | 'partial' | 'uncertain' | 'poor';
  laymanSummary: string;
  setupEffort: { level: 'low' | 'medium' | 'high'; explanation: string };
  ongoingResponsibility: string;
  evidenceFreshness: string;       // ISO date of oldest evidence claim
  unknowns: string[];
  advantages: string[];
  disadvantages: string[];
  aiAugmented: boolean;
}

interface Decision {
  id: string;
  candidateId: string;
  queryId: string;
  action: 'accepted' | 'shortlisted' | 'rejected' | 'revisit';
  rationale: string;
  decidedAt: string;
  evidenceSnapshot: EvidenceItem[];
}
```

---

## Source Adapter Design (FR-003, FR-004)

### Approved launch sources

1. **GitHub API adapter** — `GET /repos/:owner/:repo` for stars, language, license, open issues; `GET /releases` for last release date; `GET /contributors` for activity signal
2. **SPDX license adapter** — normalize license identifiers from GitHub API against SPDX list
3. **OSV adapter** — query `https://api.osv.dev/v1/query` for known vulnerabilities by package
4. **Official project site** — fetch homepage URL from GitHub for changelog/docs existence check

### Rate limiting
- GitHub: authenticated requests at 5000/hr; unauthenticated at 60/hr
- OSV: no auth required
- Fetch calls made client-side for public demo; proxied for production to avoid CORS

### Result cap
- Deterministic ranking produces ordered candidate list; only top 5 displayed and compared
- Cap enforced in `search.ts` before any AI call

---

## Responsive Layout

### Desktop (≥768px)
- Max-width content container `var(--max-content)` centered
- SearchBar full-width
- ConstraintEditor 3-column sections side by side
- ComparisonTable horizontal scroll if needed with sticky first column

### Mobile (<768px)
- ConstraintEditor sections stacked vertically, each collapsible
- ComparisonTable hidden; ComparisonCards shown instead
- Candidate list single column
- Decision actions stacked vertically in full-width buttons
- No floating actions

### Overflow prevention rules (same as Flowsensa)
- All cells/containers: `min-width: 0; overflow: hidden; text-overflow: ellipsis`
- Tables: `table-layout: fixed` on desktop, card transformation on mobile
- No `position: fixed` actions over content

---

## Accessibility

- All form inputs have `<label>` associations
- GlossaryTooltip uses `role="tooltip"` + `aria-describedby`
- Color is never the sole signal (fit verdict has text + icon + color)
- WCAG 2.2 AA contrast: `--text` on `--bg` ≥ 4.5:1; `--text-muted` on `--bg` ≥ 3:1
- Tab order follows visual flow
- Constraint drag-and-drop has keyboard equivalent (dropdown reclassify)

---

## Requirements Mapping

| Requirement | Design section |
|---|---|
| FR-001 Query intake | SearchBar + ConstraintEditor |
| FR-002 Flowsensa intake | flowsensaImport.ts + "Import from Flowsensa" button |
| FR-003 Source retrieval | Source Adapter Design |
| FR-004 Evidence normalization | EvidenceItem type, adapter normalizers |
| FR-005 Constraint-aware matching | search.ts, constraintCoverage in Candidate |
| FR-006 Transparent ranking | ranking score visible per candidate, result cap 5 |
| FR-007 Migration realism | CandidateComparison: setupEffort, ongoingResponsibility |
| FR-008 Search history | history.ts, HistoryView |
| FR-009 Duplicate detection | HistoryView similar-search banner |
| FR-010 Advisory AI matching | openrouterClient, AI Analyst flow |
| FR-011 SancusSight promotion | DecisionPanel "Copy SancusSight handoff JSON" |
| FR-012 Mnemosync tracking | DecisionPanel "Create Mnemosync task reference" |
| FR-014 Obsidian decision export | DecisionPanel "Export Obsidian decision record" |
| FR-017 Editable requirements | ConstraintEditor add/remove/edit/reclassify |
| FR-018 Plain-language comparison | ComparisonTable/Cards all required fields |
| FR-019 OpenRouter BYOK | SettingsView OpenRouter section |
| NFR-006 Responsive layout | Responsive Layout section |

---

## Technical Decisions

### TD-001: New codebase, same tech stack as Flowsensa
React 19, Vite 8, TypeScript ~6, no Tailwind. Mirrors Flowsensa conventions exactly for future monorepo option.

### TD-002: Client-side source adapters for public demo
GitHub API fetch from browser with anonymous auth limit. Synthetic evidence data for demo mode. Real adapter calls proxied via Vercel Function for production.

### TD-003: localStorage for search history
No Supabase dependency for MVP. User-scoped key with optional export. Future auth upgrade path via Supabase RLS noted but not built.

### TD-004: Result cap enforced in search.ts before render
`rankCandidates(candidates, constraints).slice(0, 5)` — cap is domain logic, not UI logic.

### TD-005: ComparisonTable/Cards as responsive pair
Single data model, two rendering paths selected by `useMediaQuery('(max-width: 768px)')`. Advantages/disadvantages always aligned structure.

### TD-006: GlossaryTooltip is self-contained accessible component
Handles all three interaction models (pointer/keyboard/touch) internally. Triggered by `data-term` attribute. Terms dictionary in `lib/glossary.ts`.
