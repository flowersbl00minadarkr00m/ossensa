# OSSensa

Evidence-grounded open-source software discovery. Describe what you need in
plain language — OSSensa extracts constraints, searches the public web,
verifies candidates against retrieved evidence, and produces plain-language
comparisons accessible to both developers and non-technical stakeholders.

**Live:** https://ossensa.vercel.app

## How discovery works

```
your words → query expansion → source fan-out → identity resolution
           → bounded evidence retrieval → licence gate → ranked top 5
           + a coverage report of what was searched, failed, or skipped
```

Discovery sources (all keyless public APIs, called from your browser):

| Source | Kind |
|---|---|
| GitHub, GitLab, Codeberg | repository forges |
| npm, crates.io, Packagist | package registries |
| Wikipedia | directory leads (must resolve to a verifiable identity) |
| OSV.dev | vulnerability evidence |

An optional serverless function (`api/fetch`) retrieves official-site and
licence-file evidence that browser CORS blocks. It is SSRF-guarded (public
DNS only, re-validated redirects, 512 KB cap, text-only, robots.txt honored)
and returns extracted metadata, never raw pages. When it isn't deployed,
the coverage report says so — evidence falls back to forge/registry metadata.

### Trust rules

- A candidate is labelled **OSI open source** only when SPDX metadata or a
  retrieved licence file supports it. Snippets and AI output can't set it.
- Conflicting licence or identity claims are displayed as conflicts, never
  silently resolved, and push the classification to *unknown*.
- Every claim carries its source URL, retrieval time, and provenance type
  (retrieved page / API metadata / search snippet / AI interpretation).
- Demo data is never substituted for a failed live search.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173  (evidence proxy unavailable in vite dev — coverage reports the gap)
vercel dev       # full stack including api/fetch
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (typecheck + vite) |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests (offline, fixture-based) |
| `npm run benchmark` | Live search-quality benchmark (FR-010, network required, gate ≥75%) |
| `npm run test:e2e` | Playwright e2e (discovery sources mocked) |
| `npm run preview` | Preview production build |

## Demo mode

Toggle "Demo mode" on the search screen to use synthetic candidates without
any API calls. Demo results are clearly labelled and never substituted for a
failed live search.

## OpenRouter BYOK

Settings → OpenRouter connects your own API key for AI-augmented summaries.
The key lives in session memory only — never persisted, logged, or sent to any
OSSensa server (there are no OSSensa servers holding secrets).

## Architecture

See `.ai/sdd/specs/` for requirements/design/tasks (spec `002-web-discovery`
covers the discovery pipeline).

```
src/
  domain/          ← types, constraint matching, ranking (deterministic)
  lib/discovery/   ← adapters, identity resolution, evidence, orchestrator, SSRF guard
  lib/             ← OSV, SPDX, OpenRouter adapters
  components/      ← React UI (search progress, coverage panel, results, detail)
api/
  fetch.ts         ← SSRF-guarded evidence retrieval (Vercel function)
tests/
  discovery.test.ts, search.test.ts   ← offline unit tests
  benchmark/                          ← versioned live search-quality gate
  e2e/                                ← Playwright with mocked sources
```
