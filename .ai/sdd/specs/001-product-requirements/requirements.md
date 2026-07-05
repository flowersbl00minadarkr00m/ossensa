# Feature: OpenSesameSensa (OSSensa) Product Requirements

> Status: Approved
> Source: Henry's open-source discovery requirements and ecosystem decisions

## Overview

OpenSesameSensa, shortened to OSSensa, is a standalone search and decision
product that finds credible open-source software for a product, feature,
workflow, or job. Its value is constraint-aware matching, evidence, freshness,
migration realism, and durable decisions—not a long repository list.

## Business Context

Stars and category labels do not answer whether software meets functional,
security, licensing, deployment, skill, and budget constraints. OSSensa connects
discovery to the product ecosystem: Flowsensa can submit a tooling need,
Mnemosync tracks evaluation and implementation, SancusSight is the canonical
accepted-asset registry, and LocalCFO can compare realistic cost.

## User Stories

### US-001: Search by job and constraints

**As a** technically capable operator  
**I want to** describe the job, features, and operating constraints  
**So that** I find open-source projects that could realistically work for me

**Acceptance Criteria:**
- [ ] Search accepts jobs, products or URLs, features, deployment constraints,
      licenses, integrations, security, skill, and budget.
- [ ] Results explain coverage and missing requirements.
- [ ] Material claims include evidence and a last-checked date.

### US-002: Compare credible candidates

**As a** prospective adopter  
**I want to** compare maintenance, security, licensing, deployment, migration,
and cost evidence  
**So that** popularity does not masquerade as suitability

**Acceptance Criteria:**
- [ ] Ranking factors and weights are visible.
- [ ] Constraints can be corrected and the comparison re-run.
- [ ] Hosted, self-hosted, and hybrid options remain distinct.

### US-003: Avoid duplicate research

**As a** returning user  
**I want to** see prior evaluations and decision reasons  
**So that** I do not repeat research and can revisit stale decisions

**Acceptance Criteria:**
- [ ] Accept, shortlist, reject, and revisit actions retain rationale.
- [ ] Similar searches surface materially related prior decisions.
- [ ] Stale evidence is flagged rather than treated as current.

### US-004: Adopt an asset into the ecosystem

**As a** user accepting a candidate  
**I want to** register and track it across the product ecosystem  
**So that** discovery becomes governed implementation

**Acceptance Criteria:**
- [ ] Accepted assets are promoted to SancusSight with provenance.
- [ ] Mnemosync receives an explicit evaluation or implementation task.
- [ ] An Obsidian-compatible decision record is available.
- [ ] Flowsensa can reference the registered asset by stable ID.

### US-005: Use AI-assisted matching safely

**As a** search user  
**I want to** use an LLM to interpret ambiguous requirements and evidence  
**So that** matching goes beyond exact keywords

**Acceptance Criteria:**
- [ ] Basic evidence browsing remains available without a model key.
- [ ] Public users supply their own OpenRouter key.
- [ ] Henry's private deployment may use a server-held OpenRouter key.
- [ ] AI claims are labeled and linked to retrieved evidence.

### US-006: Refine requirements without technical expertise

**As a** nontechnical search user  
**I want to** understand and edit what is required, preferred, or unacceptable  
**So that** the search reflects my needs without infrastructure expertise

**Acceptance Criteria:**
- [ ] Natural-language description is the primary entry; Flowsensa import is a
      secondary, editable option.
- [ ] Required, Preferred, and Not Acceptable explain their filtering effect.
- [ ] Technical terms have keyboard-, touch-, and pointer-accessible explanations.
- [ ] Users can add, remove, move, and edit constraints before rerunning results.
- [ ] Advantages and disadvantages use an aligned table on desktop and
      equivalent labeled cards on mobile.

## Functional Requirements

### FR-001: Query intake — Must Have

THE SYSTEM SHALL accept a product or URL, job, required features, deployment
and residency constraints, licenses, integrations, security needs, available
technical skill, and budget.

### FR-002: Flowsensa intake — Should Have

THE SYSTEM SHALL import versioned tooling requirements without requiring raw
process telemetry.

### FR-003: Source retrieval — Must Have

THE SYSTEM SHALL retrieve candidates and evidence through approved repository,
package, project-site, security, and curated-source adapters.

### FR-004: Evidence normalization — Must Have

THE SYSTEM SHALL normalize identity, activity, releases, license, security
signals, deployment modes, integrations, documentation, and source timestamps
while retaining original links.

### FR-005: Constraint-aware matching — Must Have

THE SYSTEM SHALL evaluate required, preferred, and disqualifying constraints
and show coverage, gaps, uncertainty, and exclusions.

### FR-006: Transparent ranking — Must Have

THE SYSTEM SHALL expose ranking factors, evidence freshness, confidence, and
material penalties so results are understandable and correctable.

### FR-007: Migration realism — Must Have

THE SYSTEM SHALL distinguish price, deployment effort, migration effort,
missing features, operating responsibility, and total-cost considerations.

### FR-008: Search and decision history — Must Have

THE SYSTEM SHALL retain user-scoped searches, candidate snapshots, decisions,
rationales, evidence dates, and supersession links.

### FR-009: Duplicate and stale decision detection — Must Have

WHEN a query materially overlaps prior work  
THE SYSTEM SHALL surface prior decisions and flag evidence needing refresh.

### FR-010: Advisory model matching — Should Have

THE SYSTEM SHALL use retrieved evidence and explicit constraints to produce a
structured advisory comparison without inventing unsupported facts.

### FR-011: SancusSight promotion — Must Have

WHEN a project is accepted  
THE SYSTEM SHALL create a versioned accepted-asset handoff containing identity,
version, license, sources, decision evidence, owner, purpose, and review date.

### FR-012: Mnemosync tracking — Must Have

WHEN a user chooses to evaluate or implement a candidate  
THE SYSTEM SHALL create an explicit Mnemosync task reference and retain its ID.

### FR-013: Flowsensa asset reference — Should Have

THE SYSTEM SHALL expose stable adopted-asset identifiers for Flowsensa.

### FR-014: Obsidian decision export — Should Have

THE SYSTEM SHALL generate a traceable Markdown decision record for explicit
export to the canonical vault.

### FR-015: LocalCFO comparison — Could Have

THE SYSTEM MAY send candidate assumptions to LocalCFO while labeling unknown
and estimated values.

### FR-016: Community corrections — Could Have

THE SYSTEM MAY support moderated corrections and maintainer-claimed profiles
without silently overriding evidence.

### FR-017: Editable requirements workspace — Must Have

THE SYSTEM SHALL let users add, remove, edit, and reclassify constraints among
Required, Preferred, and Not Acceptable, explain each category, and rerun
deterministic matching from the revised specification.

### FR-018: Plain-language comparison — Must Have

THE SYSTEM SHALL present a layperson summary, fit verdict, advantages,
disadvantages, setup effort, ongoing responsibility, evidence freshness, and
material unknowns using aligned comparison structures.

### FR-019: OpenRouter BYOK settings — Should Have

THE SYSTEM SHALL provide masked session-only OpenRouter key entry, connection
testing, model selection, disconnect, and review of the bounded query and
evidence context transmitted for AI-assisted matching.

## Non-Functional Requirements

### NFR-001: Evidence quality

- Suitability, maintenance, license, security, and migration claims cite a
  source and last-checked date.
- Unsupported model statements cannot become structured facts.

### NFR-002: Privacy and security

- Public showcase data is synthetic.
- BYOK values are never stored in the database, logs, analytics, exports, or
  frontend bundles.
- Henry's key remains an encrypted server-side secret available only to a
  protected private deployment.
- Search history and decisions are user-scoped.

### NFR-003: Freshness

- Evidence carries retrieval time and source identity.
- Refresh thresholds are defined by evidence type.

### NFR-004: Accessibility

- Search, filtering, comparison, and decisions meet WCAG 2.2 AA.

### NFR-005: Portability

- Search history, decisions, assets, and evidence snapshots export in versioned
  formats.
- OSSensa remains independently deployable.

### NFR-006: Responsive interaction and layout integrity

- Search, requirements editing, candidate comparison, decisions, and AI settings
  support desktop and mobile without clipped or overflowing text.
- Wide comparison tables transform into labeled stacked cards on narrow screens.
- Hover explanations have keyboard-focus and touch alternatives.
- Primary actions remain anchored to their owning header or panel and do not
  obscure content as floating controls.

## Out of Scope

- Automatically installing or executing discovered software.
- Treating stars as sufficient suitability evidence.
- Becoming Mnemosync's internal registry.
- Becoming the canonical accepted-asset registry.
- Owning accounting calculations.
- Silently writing to another product or Obsidian.

## Decisions

### D-005: First public audience

**Decision:** Launch targets developers and moderately tech-savvy managers who evaluate open-source tools for their own product or team stack. Language assumes familiarity with terms such as self-hosted, license, and API but does not assume procurement governance expertise. Procurement and team-approval workflows are Phase 2.  
**Reason:** Henry's explicit instruction overriding the technically-capable-individual-only recommendation.  
**Source:** Henry — direct instruction  
**Impacts:** US-001, US-006, FR-001, NFR-004

### D-006: Launch search sources and result cap

**Decision:** Launch queries the GitHub API (activity, releases, license, open issues, contributors), official project site and changelog, SPDX license index, and OSV/GitHub Advisory Database. Results are capped at a maximum of 5 candidates. npm/PyPI/Maven registries, curated lists, and web-wide search are Phase 2. The cap is enforced by the deterministic ranking layer before any AI interpretation.  
**Reason:** Henry accepted the recommended sources and added an explicit 5-candidate cap.  
**Source:** Henry — partial override (accept sources, add cap)  
**Impacts:** FR-003, FR-004, FR-005, FR-006, NFR-003


### D-001: Product name

**Decision:** The full name is OpenSesameSensa and the short label is OSSensa.  
**Reason:** It joins the Sensa family while preserving the original metaphor.  
**Source:** Direct user instruction  
**Impacts:** Entire artifact

### D-002: Standalone product

**Decision:** OSSensa remains independently usable and deployable.  
**Reason:** External discovery differs from agent monitoring.  
**Source:** Direct user instruction  
**Impacts:** NFR-005, Out of Scope

### D-003: Registry ownership

**Decision:** SancusSight owns accepted assets; OSSensa owns discovery evidence
and decisions.  
**Reason:** This avoids competing sources of truth.  
**Source:** Direct user instruction  
**Impacts:** US-004, FR-011, FR-013

### D-004: Credential lanes

**Decision:** Public users bring their own key; only Henry's protected private
instance may use his server-held key.  
**Reason:** Public requests must never spend Henry's model budget.  
**Source:** Direct user instruction  
**Impacts:** US-005, FR-010, NFR-002

## Questions

### Q-001: First public audience

**Status:** closed — resolved as D-005  
**Why it matters:** It changes defaults, terminology, and onboarding.  
**Recommended:** Technically capable individuals and small-business operators
first; procurement/team workflows later.

### Q-002: Search breadth at launch

**Status:** closed — resolved as D-006  
**Why it matters:** Web-wide search is harder to verify than bounded sources.  
**Recommended:** GitHub plus official project, release, and license pages first.
