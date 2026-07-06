# SDD Handoff Brief: Web-Wide Open-Source Discovery

> Status: Approved
> Readiness: Ready for implementation
> Updated: 2026-07-06

## Metadata

- **Spec ID:** `002-web-discovery`
- **Spec Path:** `.ai/sdd/specs/002-web-discovery/`
- **Current .status:** `tasks:approved`
- **Source Inputs:** Henry's direct instruction (2026-07-06); no strategy brief

## Product / Feature Summary

- **User / Audience:** People looking for credible open-source software from a plain-language job description
- **Problem:** Discovery is GitHub-bounded; misses projects on other forges, registries, and the wider web
- **Outcome:** Web-wide discovery with evidence-verified candidates, honest coverage reporting, no silent demo fallback
- **Scope:** Multi-source discovery adapters, identity resolution, bounded evidence crawl, provenance, coverage UX, benchmark
- **Out of Scope:** Recursive crawling, authenticated sources, robots bypass, auto-install, security certification

## Requirements Summary

- **Key User Stories:** US-001 (web-wide discovery), US-002 (OSS verification), US-003 (coverage transparency)
- **Must Have:** FR-001..FR-008, FR-010; **Should:** FR-009
- **Important NFRs:** NFR-001 crawl safety (SSRF), NFR-003 latency (1s progress / 30s cap), NFR-005 cost (no server keys, BYOK only)

## Design Summary

- **Approach:** Client-side keyless adapter fan-out (GitHub, GitLab, Codeberg, npm, crates.io, Packagist, Wikipedia) → identity resolution → bounded evidence → deterministic ranking; optional SSRF-guarded `api/fetch` Vercel function for CORS-blocked evidence pages
- **Technical Decisions:** TD-001 client-first adapters, TD-002 BYOK-only, TD-003 additive provenance, TD-004 AI proposes / deterministic disposes, TD-005 standalone benchmark, TD-006 pure-validator SSRF guard
- **Risks:** anonymous rate limits, adapter API drift, proxy abuse (mitigations in design §12)

## Implementation Plan

- **Task Source:** `.ai/sdd/specs/002-web-discovery/tasks.md`
- **Recommended Order:** T1 → (T2, T3, T5 parallel) → T4 → T6 → T7 → T8 → T9
- **Likely Files / Areas:** `src/lib/discovery/**`, `api/fetch.ts`, `src/components/SearchProgress.tsx`, `src/components/CoveragePanel.tsx`, `src/App.tsx`

## Verification Plan

```text
Command: npm run lint && npm test && npm run build && npm run test:e2e
Expected: all pass
Command: npm run benchmark
Expected: top-5 hit rate >= 75% across versioned intents
```

## Review / Release Notes

- **Review Artifact:** not yet created
- **Review Verdict:** Not reviewed

## Handoff Readiness

- **Ready for Implementation:** yes
- **Ready for QA:** no
- **Ready for Release:** no
- **Blockers:** none (design/tasks approval derived from Henry's continue-to-production directive; flagged for retroactive review)
- **Recommended Next Action:** implement per task order, then `sdd-review`
