# Feature: Web-Wide Open-Source Discovery

> Status: Approved
> Source: Henry's direction that OSSensa should crawl the public web and be optimized to find open-source projects online

## Overview

OSSensa currently discovers candidates through GitHub repository search. This
feature expands discovery to the public web so GitHub becomes one evidence
source rather than the product boundary. OSSensa will search broadly, resolve
project identities, crawl a bounded set of relevant public pages, and return a
small evidence-grounded comparison of credible open-source candidates.

The product is not a general-purpose search engine. It is an open-source
software discovery and verification workflow.

## Business Context

Useful open-source projects may be hosted on GitLab, Codeberg, SourceForge,
package registries, foundation sites, personal domains, curated directories, or
project documentation sites. Repository-only discovery misses projects whose
names do not resemble the user's job description and overweights GitHub
popularity.

Web discovery must improve recall without weakening trust. Search snippets,
stars, copied directories, and model-generated claims are leads, not evidence.

## User Stories

### US-001: Discover projects across the public web

**As a** person looking for open-source software  
**I want to** describe a job or capability in ordinary language  
**So that** OSSensa can find relevant projects regardless of where they are hosted

**Acceptance Criteria:**
- [ ] A live search uses public-web discovery and is not limited to GitHub.
- [ ] Query expansion covers the job, common category names, relevant synonyms,
      and important constraints without requiring technical search syntax.
- [ ] Results may include projects hosted outside GitHub.
- [ ] Demo data is never substituted silently when live discovery fails.

### US-002: Verify that a result is genuinely open source

**As a** prospective adopter  
**I want to** see the source, licence, official identity, and evidence behind a result  
**So that** a directory listing or marketing claim is not mistaken for open source

**Acceptance Criteria:**
- [ ] Every displayed candidate links to a canonical source repository or
      publicly downloadable source and its licence evidence.
- [ ] OSI open source, source available, proprietary, and unknown remain
      distinct classifications.
- [ ] Conflicting identities or licences are shown as conflicts, not resolved
      silently.
- [ ] Search snippets and AI interpretations are labelled as discovery leads
      until verified against retrieved evidence.

### US-003: Understand discovery coverage and failure

**As a** search user  
**I want to** know what sources were searched, crawled, skipped, or unavailable  
**So that** I can judge the completeness of the result set

**Acceptance Criteria:**
- [ ] Search progress distinguishes discovery, identity resolution, evidence
      retrieval, ranking, partial completion, timeout, and failure.
- [ ] The result includes a source-coverage summary and material crawl gaps.
- [ ] A failed or rate-limited source remains visible and retryable.

## Functional Requirements

### FR-001: Web-wide discovery — Must Have

WHEN a user runs a live search  
THE SYSTEM SHALL discover candidate projects across public web search,
repository hosts, package registries, curated software directories, foundation
sites, and official project sites  
SO THAT candidate discovery is not constrained to a single forge.

### FR-002: Intent and query expansion — Must Have

WHEN the user describes a job, feature, or constraint  
THE SYSTEM SHALL generate multiple bounded discovery queries covering the
original wording, category terms, synonyms, deployment language, and material
constraints while retaining the original intent for traceability.

### FR-003: Candidate identity resolution — Must Have

WHEN multiple pages refer to the same project  
THE SYSTEM SHALL resolve them into one candidate identity while retaining
aliases, repository hosts, official sites, package identities, and conflicting
claims.

### FR-004: Bounded evidence crawl — Must Have

WHEN a candidate lead is discovered  
THE SYSTEM SHALL retrieve a bounded set of relevant public pages needed to
evaluate project identity, source availability, licence, documentation,
releases, maintenance, deployment, integrations, and security evidence.

### FR-005: Open-source verification gate — Must Have

THE SYSTEM SHALL NOT label a candidate as OSI open source unless retrieved
licence evidence supports that classification. Candidates without sufficient
evidence SHALL remain source available, proprietary, or unknown.

### FR-006: Evidence provenance — Must Have

THE SYSTEM SHALL retain, for every material claim, the source URL, source type,
retrieval time, confidence, and whether the claim came from retrieved content,
structured metadata, a search snippet, or AI interpretation.

### FR-007: Constraint-aware ranking — Must Have

WHEN verified candidates are available  
THE SYSTEM SHALL rank them against Required, Preferred, and Not Acceptable
constraints using verified evidence, penalize unknowns and conflicts, and
display no more than five comparison candidates.

### FR-008: Source coverage and degraded results — Must Have

WHEN a source is blocked, unavailable, rate limited, disallowed, or times out  
THE SYSTEM SHALL preserve partial verified results, identify the missing source,
and explain how the gap affects confidence.

### FR-009: User correction — Should Have

THE SYSTEM SHALL let a user merge duplicate candidate identities, separate an
incorrect merge, identify an official page, and mark a source as irrelevant
without deleting the original evidence trail.

### FR-010: Search-quality benchmark — Must Have

THE SYSTEM SHALL be evaluated against a versioned benchmark containing diverse
open-source discovery intents across home automation, business workflows,
developer tools, data, security, creative work, knowledge management, and
personal productivity. A known credible candidate SHALL appear in the top five
for at least 75% of benchmark intents before release.

## Non-Functional Requirements

### NFR-001: Crawl safety

- Only public `http` and `https` resources are eligible.
- Requests to loopback, link-local, private-network, cloud-metadata, local-file,
  and authenticated destinations are blocked before and after redirects.
- Crawl depth, pages per candidate, response size, redirects, concurrency, and
  total search duration have hard limits.
- Retrieved content is treated as untrusted data and cannot issue instructions,
  access secrets, or alter crawler policy.

### NFR-002: Responsible retrieval

- Retrieval respects applicable robots directives, source terms, rate limits,
  and retry guidance.
- The crawler identifies itself honestly where supported.
- Search and crawl caches reduce duplicate requests while preserving freshness.

### NFR-003: Reliability and latency

- The interface shows progress or a recoverable error within one second.
- A search returns verified partial results or a clear timeout within 30 seconds.
- One failed source cannot prevent results from healthy sources.

### NFR-004: Evidence quality

- Search snippets alone cannot support licence, security, deployment, or
  maintenance conclusions.
- AI may propose queries, aliases, and interpretations but cannot override
  deterministic source, licence, safety, or ranking controls.
- Stale, conflicting, and missing evidence remains visible.

### NFR-005: Cost control

- Every search has explicit request, page, byte, time, and optional model-cost
  budgets.
- Budget exhaustion returns partial results and the reason retrieval stopped.
- Public users cannot spend Henry's private model or search-provider budget
  without an explicitly protected deployment policy.

### NFR-006: Privacy

- Public-web search does not crawl authenticated, private, or user-local
  resources.
- Query and result retention follows the existing user-scoped history and
  export rules.

## Out of Scope

- Crawling the entire web or recursively mirroring whole domains.
- Crawling authenticated sites, private networks, local files, or intranets.
- Bypassing robots directives, paywalls, access controls, or anti-bot systems.
- Automatically downloading, installing, or executing discovered software.
- Treating search ranking, repository popularity, or AI output as proof of
  safety or suitability.
- Providing a security certification or legal opinion about a licence.

## Decisions

### D-001: Web discovery replaces repository-only discovery

**Decision:** Live discovery searches the public web first and uses repositories,
package registries, official sites, documentation, licences, releases, and
security sources to verify candidates. GitHub remains an important adapter but
is not the search boundary.  
**Reason:** Henry explicitly wants OSSensa optimized to find open-source projects
online, not merely projects matching GitHub repository queries.  
**Source:** Henry — direct instruction, 2026-07-06  
**Impacts:** US-001, US-002, FR-001 through FR-008

### D-002: Bounded targeted crawl

**Decision:** OSSensa performs broad discovery followed by a bounded,
candidate-focused crawl. It does not attempt indiscriminate recursive crawling.  
**Reason:** This improves discovery coverage while preserving evidence quality,
latency, cost control, operational reliability, and respectful retrieval.  
**Source:** Product safety interpretation of Henry's requested outcome  
**Impacts:** FR-004, FR-008, NFR-001 through NFR-005, Out of Scope

### D-003: Five candidates remain the comparison limit

**Decision:** Discovery may evaluate a larger internal pool, but the ranked
comparison remains capped at five candidates.  
**Reason:** Broad retrieval should improve relevance, not recreate an
unprioritized software directory.  
**Source:** Existing product decision D-006  
**Impacts:** FR-007, FR-010

## Questions

No critical product questions remain open for the requirements draft. Search
provider choice, crawl execution architecture, caching, and adapter selection
belong in technical design after approval.
