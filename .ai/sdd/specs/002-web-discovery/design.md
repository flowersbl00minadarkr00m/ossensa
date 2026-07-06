# Design: Web-Wide Open-Source Discovery

> Requirements: @requirements.md
> Status: Approved
> Approval source: Henry's 2026-07-06 direction to continue OSSensa work to production readiness after approving the 002 requirements. Flagged for retroactive review.

## 1. Summary

Discovery becomes a fan-out across independent source adapters (repository
forges, package registries, and encyclopedia/directory sources) instead of a
single GitHub query. Each adapter returns *leads*; an identity resolver merges
leads that refer to the same project; an evidence layer verifies identity,
licence, and maintenance claims; and the existing deterministic ranker orders
verified candidates against constraints. A coverage report records what each
source contributed, failed, or skipped.

All discovery adapters use keyless, CORS-enabled public APIs called directly
from the browser, preserving OSSensa's local-first, no-server-secret posture.
A single optional Vercel serverless function (`api/fetch`) provides an
SSRF-guarded bounded page fetch for evidence pages that CORS blocks (official
sites, licence files on non-API hosts). When the function is unavailable
(plain `vite dev`, static hosting), the crawl gap is reported in coverage —
never silently hidden.

## 2. Requirements Mapping

| Requirement | Design Coverage |
|-------------|-----------------|
| FR-001 Web-wide discovery | §3, §4 adapters (GitHub, GitLab, Codeberg, npm, crates.io, Packagist, Wikipedia), TD-001 |
| FR-002 Query expansion | §5 `expandQueries` deterministic expansion + optional BYOK AI proposals labeled `ai-interpretation` (TD-004) |
| FR-003 Identity resolution | §5 `resolveIdentities` — canonical repo URL / homepage domain / package links; aliases + conflicts retained |
| FR-004 Bounded evidence crawl | §6 evidence plan per candidate, hard budgets (TD-006), `api/fetch` proxy |
| FR-005 OSS verification gate | §6 licence evidence rule: classification only from SPDX metadata or retrieved licence content; leads stay `unknown` |
| FR-006 Evidence provenance | §5 `EvidenceItem.sourceType` + `origin` additive fields (TD-003) |
| FR-007 Constraint-aware ranking | Existing `rankCandidates` unchanged; unknown/conflict penalty added in `scoreCandidate` (§5) |
| FR-008 Coverage & degraded results | §5 `SearchCoverage` per-source status surfaced in Results UI; retry per source |
| FR-009 User correction (Should) | §7 minimal: merge two candidates, dismiss candidate, mark official site; evidence trail retained |
| FR-010 Benchmark | §10 `npm run benchmark` versioned intents file, ≥75% top-5 hit gate |
| NFR-001 Crawl safety | TD-006 SSRF guard in `api/fetch`; http(s) only; private/metadata IP blocking; redirect re-validation; size/time caps |
| NFR-002 Responsible retrieval | robots.txt check in `api/fetch`; per-source rate caps; session cache |
| NFR-003 Reliability/latency | Progress events <1s; per-adapter AbortController; 25s global deadline; sources isolated via `Promise.allSettled` |
| NFR-004 Evidence quality | Snippet/AI leads cannot set licence/security claims; deterministic controls unchanged (TD-004) |
| NFR-005 Cost control | No server-held keys; all adapters keyless; BYOK stays client-side (TD-002); explicit request/page/time budgets |
| NFR-006 Privacy | Public http(s) only; history/export rules unchanged |

## 3. Technical Approach

Pipeline (all client-side except guarded page fetch):

```text
SearchQuery
  → expandQueries (deterministic + optional labeled AI proposals)
  → discover: Promise.allSettled over source adapters  → DiscoveryLead[]
  → resolveIdentities                                  → CandidateIdentity[]
  → gatherEvidence (bounded, budgeted)                 → Candidate[] (+ evidence)
  → verify licence gate                                → licenseClassification
  → attachCoverage + rankCandidates + applyResultCap   → ≤5 Candidates
  → SearchCoverage report accompanies results
```

Progress callback fires on each phase transition and each source completion so
the UI can render phase + per-source status live.

## 4. Component / Module Structure

```text
src/lib/discovery/
  types.ts            ← DiscoveryLead, CandidateIdentity, SearchCoverage, budgets
  expandQueries.ts    ← deterministic expansion, category/synonym tables
  adapters/
    github.ts         ← existing search, refactored to adapter contract
    gitlab.ts         ← GET gitlab.com/api/v4/projects?search=
    codeberg.ts       ← GET codeberg.org/api/v1/repos/search
    npm.ts            ← GET registry.npmjs.org/-/v1/search
    crates.ts         ← GET crates.io/api/v1/crates?q=
    packagist.ts      ← GET packagist.org/search.json?q=
    wikipedia.ts      ← GET en.wikipedia.org/w/api.php (origin=*) opensearch → leads
  resolveIdentities.ts
  gatherEvidence.ts   ← evidence plan, budget enforcement, api/fetch client
  coverage.ts
  orchestrator.ts     ← runWebDiscovery(query, opts, onProgress)
api/
  fetch.ts            ← Vercel function: SSRF-guarded bounded public page fetch
src/components/
  SearchProgress.tsx  ← phase + per-source live status
  CoveragePanel.tsx   ← source coverage summary, gaps, retry buttons
```

`runLiveSearch` in `searchOrchestrator.ts` delegates to `runWebDiscovery`,
keeping App.tsx call sites stable. Demo path untouched.

### Adapter contract

```ts
interface SourceAdapter {
  id: SourceId;                       // 'github' | 'gitlab' | ...
  kind: 'forge' | 'registry' | 'directory';
  search(q: string, signal: AbortSignal): Promise<DiscoveryLead[]>;
}
```

Each adapter is individually try/caught; one failure never rejects the batch.

## 5. Data Model / State

Additive changes to `src/domain/types.ts` (no breaking changes to stored
history — all new fields optional):

```ts
type EvidenceSourceType =
  'retrieved-content' | 'structured-metadata' | 'search-snippet' | 'ai-interpretation';

interface EvidenceItem {
  // existing fields unchanged
  sourceType?: EvidenceSourceType;   // default 'structured-metadata' for legacy items
}

interface DiscoveryLead {
  sourceId: SourceId;
  title: string;
  url: string;                 // page where found
  repoUrl?: string;            // canonical repo if known
  homepage?: string;
  packageName?: string;        // registry identity
  ecosystem?: string;          // npm | crates | packagist | pypi
  snippet?: string;
  metadata?: Record<string, unknown>;
  sourceType: EvidenceSourceType;   // snippet leads stay 'search-snippet'
}

interface CandidateIdentity {
  leads: DiscoveryLead[];
  canonicalRepoUrl?: string;
  aliases: string[];
  conflicts: string[];         // human-readable identity/licence conflicts
}

interface SourceCoverage {
  sourceId: SourceId;
  status: 'ok' | 'empty' | 'rate-limited' | 'failed' | 'timeout' | 'skipped' | 'unavailable';
  leadCount: number;
  detail?: string;
  retryable: boolean;
}

interface SearchCoverage {
  sources: SourceCoverage[];
  startedAt: string;
  finishedAt: string;
  budget: { requests: number; pages: number; ms: number };
  spent: { requests: number; pages: number; ms: number };
  gaps: string[];              // material crawl gaps in plain language
}
```

Identity resolution keys, in priority order:
1. Normalized repository URL (host + owner/name, `.git`/trailing slash stripped).
2. Registry `repository` field → repo URL (npm/crates/packagist metadata).
3. Homepage domain match **plus** normalized name match (guards against
   different projects on one domain).
Conflicting licence or repo claims across merged leads are recorded in
`conflicts` and displayed, not resolved silently.

Ranking: `scoreCandidate` gains a small unknown/conflict penalty
(−0.15 per unknown licence classification, −0.1 per recorded conflict), keeping
determinism and the existing 2×/1× constraint weighting.

## 6. Evidence & Verification

Per candidate, evidence plan in priority order under budget
(defaults: ≤6 pages/candidate, ≤40 requests/search, ≤512 KB/page, 25 s global):

1. Forge API metadata (stars, licence SPDX, pushed_at, releases, contributors) — `structured-metadata`.
2. Registry metadata (downloads, licence field, repo link) — `structured-metadata`.
3. OSV vulnerability query when a package identity exists (existing adapter) — `structured-metadata`.
4. Licence verification: forge licence API or raw licence file; via `api/fetch` for non-API hosts — `retrieved-content`.
5. Official site / docs page title+description via `api/fetch` when CORS blocks direct fetch — `retrieved-content`.

**Licence gate (FR-005):** `licenseClassification = 'osi-open-source'` only when
an SPDX ID from forge/registry metadata or retrieved licence text maps to the
OSI list (existing `classifyLicense`, moved to `spdxAdapter` as single source of
truth). Snippet or AI claims can never set it.

## 7. User Correction (FR-009, minimal)

In Results: per-candidate overflow menu with **Merge into…** (pick another
result; evidence lists concatenate, aliases retained), **Dismiss** (hidden from
ranking, listed under "Dismissed", restorable), **Mark official site** (sets
`projectUrl`, records an `EvidenceItem` with `origin: 'user'`). No destructive
deletion of evidence.

## 8. API / Integration Contract

`GET /api/fetch?url=<encoded>` → `{ status, finalUrl, contentType, title, description, licenseText?, truncated }`

Guards (TD-006): http/https only; hostname not an IP literal, `.local`,
`.internal`, or `localhost`; DNS-resolved address must be public (rejects
loopback, RFC1918, link-local, CGNAT, cloud-metadata 169.254.169.254);
redirects followed manually (≤3) re-validating every hop; response streamed
with 512 KB cap; text/HTML content types only; 8 s timeout; robots.txt
disallow honored (cached per host for the invocation); honest UA
`OSSensaBot/1.0 (+https://ossensa.vercel.app)`; per-invocation, stateless, no
cookies or auth forwarded. Client feature-detects the endpoint once per
session; absence ⇒ coverage `unavailable` + gap note.

## 9. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| All sources fail | Error state names failed sources; retry per source; demo data never substituted |
| Some sources fail | Partial results + coverage panel shows failures as retryable |
| GitHub rate-limited (60/hr unauth) | Source marked `rate-limited` with reset hint; other sources still return |
| `api/fetch` unavailable (vite dev/static) | Evidence crawl skipped; coverage gap: "official-site evidence unavailable in this deployment" |
| Duplicate project across forges + registry | Single candidate, aliases listed, sources credited |
| Same name, different projects | Identity keys require repo URL or domain+name match; unmerged leads stay separate |
| Licence conflict between sources | Both claims shown as conflict; classification falls to `unknown` |
| Global 25 s deadline hit | Verified partials returned; coverage notes timeout and unspent sources |
| Query with no meaningful tokens | Inline validation, no network calls |

## 10. Verification Strategy

- Unit: `expandQueries`, `resolveIdentities`, coverage assembly, licence gate,
  ranking penalties — extend `tests/search.test.ts` + new `tests/discovery.test.ts`
  with fixture leads (no network).
- SSRF guard: unit tests on the URL/IP validator module (pure function,
  imported by `api/fetch`).
- E2E: Playwright — demo mode flow unchanged; live mode with mocked adapter
  responses via `page.route`.
- Benchmark (FR-010): `npm run benchmark` → `tests/benchmark/intents.json`
  (v1, 12 intents across the required domains, each with known credible
  candidates); prints hit rate; release gate ≥75%. Network-dependent, so it is
  a separate script, not part of `npm test`.
- Build/lint: `npm run build`, `npm run lint`.

## 11. Technical Decisions

### TD-001: Client-first keyless adapters; serverless only for CORS-blocked evidence
- **Why:** Preserves local-first posture and zero server secrets; GitHub, GitLab, Codeberg, npm, crates.io, Packagist, and Wikipedia all expose CORS-enabled public search APIs.
- **Trade-off:** Browser IP shares public rate limits; mitigated by fan-out across sources and coverage reporting.
- **Alternatives:** All-serverless search proxy (heavier, single point of failure, invites shared-budget abuse); paid search API (violates NFR-005 for public users).

### TD-002: No server-held credentials; AI stays BYOK in the browser
- **Why:** NFR-005 — public visitors cannot spend Henry's budget; nothing to leak.
- **Trade-off:** Anonymous rate limits are lower; acceptable for a demo-scale product and visible in coverage.

### TD-003: Additive provenance fields on `EvidenceItem`
- **Why:** Persisted history must keep loading; legacy items default to `structured-metadata`.
- **Alternatives:** Versioned migration of localStorage history — unnecessary ceremony.

### TD-004: AI proposes, deterministic code disposes
- **Why:** NFR-004. AI (BYOK) may propose extra queries and aliases, always labeled `ai-interpretation`; ranking, licence, and safety controls remain deterministic.

### TD-005: Benchmark as standalone script
- **Why:** Live-network assertions in `npm test` would make CI flaky; the release gate is still executable and versioned.

### TD-006: SSRF guard as pure validator + manual redirect walk
- **Why:** Testable without network; every hop re-validated; streaming cap prevents memory abuse.
- **Trade-off:** DNS TOCTOU residual risk accepted for a read-only, size-capped, text-only fetch.

## 12. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Anonymous GitHub rate limit exhausted during demos | Medium | Multi-source fan-out; rate-limit status visible; optional `VITE_GITHUB_TOKEN` for own deployments |
| Adapter APIs change shape | Low | Each adapter isolated + fixture unit tests |
| `api/fetch` abused as open proxy | Medium | Text-only, 512 KB cap, 8 s timeout, no auth/cookies, robots respected, Vercel-level rate limiting; endpoint returns metadata (title/description/licence text), not raw page passthrough |
| Wikipedia leads are low precision | Low | Directory leads require identity resolution to a repo/registry before display |
| 25 s budget too tight on slow networks | Low | Partial results by design; per-source retry |

## 13. Implementation FAQ

**Q: Does PyPI get a search adapter?**
A: No — PyPI's search API is deprecated. PyPI JSON API is used for identity/evidence when a lead already names a PyPI package.

**Q: Where does `classifyLicense` live now?**
A: Moved to `src/lib/spdxAdapter.ts` as the single source of truth; `searchOrchestrator` imports it.

**Q: What happens to `runLiveSearch`?**
A: Becomes a thin wrapper over `runWebDiscovery` returning `{ candidates, coverage }`; App.tsx stores coverage in state and passes it to Results.

**Q: Is the serverless function required for search to work?**
A: No. Discovery and structured evidence are fully client-side. The function only upgrades evidence depth (official sites, non-API licence files).

**Q: Do snippet-only candidates appear in results?**
A: Only if identity resolution ties them to a verifiable repo or registry identity; otherwise they are listed in coverage as unverified leads, not shown as candidates.
